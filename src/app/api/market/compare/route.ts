import { connection } from "next/server";
import { z } from "zod";

import { validationErrorResponse } from "@/server/http";
import { getComparison, MAX_COMPARE_TICKERS } from "@/server/market/compare";

const querySchema = z.object({
  tickers: z
    .string()
    .transform((s) => [
      ...new Set(
        s
          .split(",")
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean),
      ),
    ])
    .pipe(
      z
        .array(z.string().regex(/^[A-Z0-9.]{1,12}$/))
        .min(1)
        .max(MAX_COMPARE_TICKERS),
    ),
});

/**
 * GET ?tickers=NVDA,AAPL → live price, 24h change, logo and a 7-day sparkline
 * per ticker, for comparison tables in the chat. Tickers are looked up in the
 * stock registry; unknown ones come back in `unknown`. Sparklines still
 * loading come back in `pending`, for the browser to ask again.
 */
export async function GET(request: Request) {
  await connection();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const result = await getComparison(parsed.data.tickers);
  return Response.json(result, {
    headers: {
      "cache-control":
        result.pending.length === 0 ? "public, s-maxage=30, stale-while-revalidate=30" : "no-store",
    },
  });
}
