import type { NextRequest } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { exampleQuote, exampleQuoteFor } from "@/server/markets/screener";

/**
 * GET ?i=0|1|2 (NVDA, TSLA, AAPL) or ?ticker= (one of those or the current
 * top-3 tech stocks) → a real Jupiter quote for 10 USDC of it (no taker:
 * pricing only, nothing to sign). Cached 30 s per stock.
 */
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  const index = Number(request.nextUrl.searchParams.get("i") ?? 0) || 0;
  try {
    const quote = ticker ? await exampleQuoteFor(ticker.slice(0, 20)) : await exampleQuote(index);
    if (!quote) return errorResponse(400, "No example quote for that stock");
    return Response.json(quote, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[markets] example quote failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
