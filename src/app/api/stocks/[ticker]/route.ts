import type { NextRequest } from "next/server";

import type { StockResponse } from "@/lib/stocks/api";
import { errorResponse, jsonOr502 } from "@/server/http";
import { stockUniverse } from "@/server/stocks/universe";
import { normalizeName } from "@/lib/stocks/group";

/** GET /api/stocks/NVDA (or a token symbol, NVDAx) → that company; 404 when it isn't listed. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  return jsonOr502(
    `[stocks] ${ticker} failed`,
    async () => {
      const { byName, asOf } = await stockUniverse();
      const stock = byName.get(normalizeName(ticker));
      return stock
        ? ({ stock, asOf } satisfies StockResponse)
        : errorResponse(404, `${ticker} isn't a listed stock`);
    },
    "public, s-maxage=30",
  );
}
