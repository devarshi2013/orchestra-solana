import type { NextRequest } from "next/server";

import { orderQuerySchema } from "@/lib/swap/requests";
import { USDC_MINT } from "@/lib/tokens";
import { errorResponse, upstreamErrorResponse, validationErrorResponse } from "@/server/http";
import { getOrder } from "@/server/jupiter/swap";
import { findStockToken } from "@/server/stocks/universe";

/**
 * Proxies Jupiter GET /swap/v2/order for USDC ↔ a listed stock token only
 * (Jupiter-verified and tagged `stocks`; see src/server/stocks/universe.ts).
 * With `taker`, the response includes a transaction for the user's wallet to sign.
 */
export async function GET(request: NextRequest) {
  const parsed = orderQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { inputMint, outputMint } = parsed.data;
  try {
    const stockMint =
      inputMint === USDC_MINT ? outputMint : outputMint === USDC_MINT ? inputMint : null;
    if (!stockMint || !(await findStockToken(stockMint)))
      return errorResponse(400, "Only USDC and listed stock tokens can be traded");
    return Response.json(await getOrder(parsed.data, request.signal));
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
