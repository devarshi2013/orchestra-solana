import { z } from "zod";

import { MARKET_MINTS, WINDOW_IDS, WINDOWS } from "@/lib/market/config";
import { validationErrorResponse } from "@/server/http";
import { getHistory } from "@/server/market/history";

const querySchema = z.object({
  window: z.enum(WINDOW_IDS as [string, ...string[]]),
  mints: z
    .string()
    .transform((s) => [...new Set(s.split(",").filter(Boolean))])
    .pipe(
      z
        .array(z.enum(MARKET_MINTS as [string, ...string[]]))
        .min(1)
        .max(MARKET_MINTS.length),
    ),
});

/**
 * GET ?window=24h&mints=a,b → price history (candles) per token, from
 * GeckoTerminal via our server cache. Answers within a few seconds: tokens
 * still loading come back in `pending`, for the browser to ask again. Only
 * complete answers are cached at the CDN.
 */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const window = WINDOWS[parsed.data.window as keyof typeof WINDOWS];
  const result = await getHistory(parsed.data.mints, window);
  const complete = result.pending.length === 0 && Object.keys(result.failed).length === 0;
  const maxAge = Math.floor(window.ttlMs / 1000);
  return Response.json(
    { window: window.id, ...result },
    {
      headers: {
        "cache-control": complete
          ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}`
          : "no-store",
      },
    },
  );
}
