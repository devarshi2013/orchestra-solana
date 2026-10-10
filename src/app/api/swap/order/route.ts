import type { NextRequest } from "next/server";

import { orderQuerySchema } from "@/lib/swap/requests";
import { STOCKS } from "@/lib/stocks/registry";
import { USDC_MINT } from "@/lib/tokens";
import { errorResponse, upstreamErrorResponse, validationErrorResponse } from "@/server/http";
import { getOrder } from "@/server/jupiter/swap";

const REGISTRY_MINTS = new Set(STOCKS.map((s) => s.mint));

/**
 * Proxies Jupiter GET /swap/v2/order for USDC ↔ a registry stock token only
 * (the registry is the only source of tradable tokens). With `taker`, the
 * response includes a transaction for the user's wallet to sign.
 */
export async function GET(request: NextRequest) {
  const parsed = orderQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { inputMint, outputMint } = parsed.data;
  const pair =
    (inputMint === USDC_MINT && REGISTRY_MINTS.has(outputMint)) ||
    (outputMint === USDC_MINT && REGISTRY_MINTS.has(inputMint));
  if (!pair) return errorResponse(400, "Only USDC and Quill's listed stocks can be traded");

  try {
    // The browser's buy flow retries 429s itself (showing "Retrying…"), so no retry here.
    return Response.json(await getOrder(parsed.data, request.signal, { retryRateLimit: false }));
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
