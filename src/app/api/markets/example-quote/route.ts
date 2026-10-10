import type { NextRequest } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { exampleQuote } from "@/server/markets/screener";

/**
 * GET ?i=0|1|2 → a real Jupiter quote for 10 USDC of NVDA, TSLA or AAPL (no
 * taker: pricing only, nothing to sign). Cached 30 s per stock.
 */
export async function GET(request: NextRequest) {
  const index = Number(request.nextUrl.searchParams.get("i") ?? 0) || 0;
  try {
    return Response.json(await exampleQuote(index), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[markets] example quote failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
