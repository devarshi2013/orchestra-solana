import type { NextRequest } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { isListed, livePricesForTickers } from "@/server/markets/screener";

const MAX_TICKERS = 40;

/** GET ?tickers=NVDA,SOL → live prices (registry stocks and the listed crypto tokens only; cached 10 s each). */
export async function GET(request: NextRequest) {
  const tickers = [
    ...new Set((request.nextUrl.searchParams.get("tickers") ?? "").split(",").filter(Boolean)),
  ];
  if (tickers.length === 0 || tickers.length > MAX_TICKERS || !tickers.every(isListed))
    return errorResponse(400, "Ask for 1 to 40 registry stocks");
  try {
    return Response.json(
      { prices: await livePricesForTickers(tickers) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[markets] prices failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
