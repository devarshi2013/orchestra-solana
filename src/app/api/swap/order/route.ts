import type { NextRequest } from "next/server";

import { orderQuerySchema } from "@/lib/swap/requests";
import { upstreamErrorResponse, validationErrorResponse } from "@/server/http";
import { getOrder } from "@/server/jupiter/swap";

/** Proxies Jupiter GET /swap/v2/order. With `taker`, the response includes a tx to sign. */
export async function GET(request: NextRequest) {
  const parsed = orderQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return Response.json(await getOrder(parsed.data, request.signal));
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
