import type { NextRequest } from "next/server";
import { z } from "zod";

import { friendlyError } from "@/lib/friendly-error";
import { WINDOW_IDS, type WindowId } from "@/lib/market/config";
import { errorResponse } from "@/server/http";
import { chartCandles, companyTokens } from "@/server/markets/screener";

const querySchema = z.object({
  ticker: z.string().trim().min(1).max(20),
  window: z.enum(WINDOW_IDS as [WindowId, ...WindowId[]]),
});

/** GET ?ticker=NVDA&window=24h → candles for the stock page's chart (GeckoTerminal, cached per window). */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success || !companyTokens(parsed.data.ticker))
    return errorResponse(400, "Unknown stock or timeframe");
  try {
    const candles = await chartCandles(parsed.data.ticker, parsed.data.window);
    return Response.json({ candles }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[markets] history failed", parsed.data, error);
    return errorResponse(502, friendlyError(error));
  }
}
