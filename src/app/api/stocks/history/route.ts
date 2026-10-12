import type { NextRequest } from "next/server";
import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { CHART_WINDOWS, type StockHistoryResponse } from "@/lib/stocks/api";
import { errorResponse, jsonOr502, validationErrorResponse } from "@/server/http";
import { chartsConfigured } from "@/server/market/coingecko";
import { stockCandles } from "@/server/stocks/history";
import { findStockToken } from "@/server/stocks/universe";

const querySchema = z.object({ mint: base58AddressSchema, window: z.enum(CHART_WINDOWS) });

/** GET ?mint=&window=24h → the stock token's candles (empty when it has no pool with history). */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  if (!chartsConfigured()) return errorResponse(503, "Charts are off (no COINGECKO_API_KEY)");
  const { mint, window } = parsed.data;
  return jsonOr502(`[stocks] history failed ${mint} ${window}`, async () => {
    if (!(await findStockToken(mint))) return errorResponse(404, "Not a listed stock token");
    return {
      mint,
      window,
      candles: await stockCandles(mint, window),
    } satisfies StockHistoryResponse;
  });
}
