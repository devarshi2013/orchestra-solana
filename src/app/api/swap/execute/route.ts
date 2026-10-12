import { executeBodySchema } from "@/lib/swap/requests";
import { errorResponse, upstreamErrorResponse, validationErrorResponse } from "@/server/http";
import { executeOrder } from "@/server/jupiter/swap";

/**
 * Forwards a wallet-signed transaction to Jupiter's /execute, which lands it.
 * Responds 200 with { status: "Success" | "Failed", code, ... } whenever
 * Jupiter processed it; the client decides what a failure means.
 */
export async function POST(request: Request) {
  // No JSON document parses to undefined.
  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) return errorResponse(400, "Body must be JSON");
  const parsed = executeBodySchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return Response.json(await executeOrder(parsed.data));
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
