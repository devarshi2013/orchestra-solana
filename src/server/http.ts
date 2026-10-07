import "server-only";

import { z } from "zod";

import { JupiterApiError } from "./jupiter/client";

/** Error envelope returned by every /api route. Parsed by lib/api-client.ts. */
export type ApiErrorBody = {
  error: { message: string; code?: number; signature?: string; requestId?: string };
};

export function errorResponse(
  status: number,
  message: string,
  extra: Omit<ApiErrorBody["error"], "message"> = {},
): Response {
  return Response.json({ error: { message, ...extra } } satisfies ApiErrorBody, { status });
}

export function validationErrorResponse(error: z.ZodError): Response {
  return errorResponse(400, z.prettifyError(error));
}

const jupiterErrorBodySchema = z
  .object({
    error: z.string().optional(),
    code: z.number().optional(),
    signature: z.string().optional(),
  })
  .partial();

/**
 * Translate anything thrown while calling Jupiter into our error envelope.
 * Jupiter's own 400 bodies ({ error, code }) are passed through so the client
 * can classify them; auth/server problems become 502s.
 */
export function upstreamErrorResponse(error: unknown): Response {
  if (error instanceof JupiterApiError) {
    let parsed: z.infer<typeof jupiterErrorBodySchema> = {};
    try {
      parsed = jupiterErrorBodySchema.parse(JSON.parse(error.body));
    } catch {
      // non-JSON body; fall through with defaults
    }
    const requestId = error.requestId ?? undefined;
    console.error(
      `[jupiter] ${error.status} request=${requestId} body=${error.body.slice(0, 500)}`,
    );

    if (error.status === 429) {
      return errorResponse(429, "Jupiter rate limit reached", { requestId });
    }
    if (error.status === 401 || error.status === 403) {
      return errorResponse(502, "Jupiter rejected the server's API key", { requestId });
    }
    if (error.status >= 500) {
      return errorResponse(502, parsed.error ?? "Jupiter is unavailable", {
        requestId,
        signature: parsed.signature,
      });
    }
    return errorResponse(400, parsed.error ?? `Jupiter returned ${error.status}`, {
      code: parsed.code,
      signature: parsed.signature,
      requestId,
    });
  }
  if (error instanceof z.ZodError) {
    console.error("[jupiter] unexpected response shape", z.prettifyError(error));
    return errorResponse(502, "Unexpected response from Jupiter");
  }
  // undici throws TypeError("fetch failed") for DNS/TLS/socket errors.
  if (error instanceof TypeError && error.message === "fetch failed") {
    console.error("[jupiter] unreachable", error.cause ?? error);
    return errorResponse(502, "Couldn't reach Jupiter");
  }
  console.error("[api] unhandled error", error);
  return errorResponse(500, "Internal server error");
}
