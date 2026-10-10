import type { NextRequest } from "next/server";

import { errorResponse } from "@/server/http";
import { sparklines } from "@/server/markets/screener";

const MAX_TICKERS = 40;

/** GET ?tickers=NVDA,AAPL&window=24h|7d → sparklines; tickers still loading come back in `pending`. */
export async function GET(request: NextRequest) {
  const tickers = [
    ...new Set((request.nextUrl.searchParams.get("tickers") ?? "").split(",").filter(Boolean)),
  ];
  if (tickers.length === 0 || tickers.length > MAX_TICKERS)
    return errorResponse(400, "Ask for 1 to 40 stocks");
  const window = request.nextUrl.searchParams.get("window") === "7d" ? "7d" : "24h";
  return Response.json(await sparklines(tickers, window), {
    headers: { "cache-control": "no-store" },
  });
}
