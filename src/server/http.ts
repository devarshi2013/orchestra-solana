import "server-only";

import { z } from "zod";

import type { ApiErrorBody } from "@/lib/api-client";
import { friendlyError } from "@/lib/friendly-error";

import { JupiterApiError } from "./jupiter/client";

export type { ApiErrorBody };

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

/**
 * `load()`'s result as JSON (a Response it returns is sent as is), or, when it
 * throws, a friendly error with the details logged under `label`: 429 when an
 * upstream rate-limited us, 502 otherwise.
 */
export async function jsonOr502(
  label: string,
  load: () => Promise<unknown>,
  cacheControl = "no-store",
): Promise<Response> {
  try {
    const data = await load();
    if (data instanceof Response) return data;
    return Response.json(data, { headers: { "cache-control": cacheControl } });
  } catch (error) {
    console.error(label, error);
    const rateLimited = error instanceof JupiterApiError && error.status === 429;
    return errorResponse(rateLimited ? 429 : 502, friendlyError(error));
  }
}

/**
 * The client's IP for rate limiting (Vercel and `next dev`/`next start` set
 * x-forwarded-for), or null when the request doesn't say: such requests are
 * refused rather than sharing one bucket.
 */
export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  null;

/** The 400 for a request whose client can't be identified (see clientIp). */
export const unidentifiedClient = () => errorResponse(400, "Can't identify the client.");

const jupiterErrorBodySchema = z
  .object({ error: z.string(), code: z.number(), signature: z.string() })
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
    // jupiterFetch already logged the status, request ID and body (server only).
    // The browser gets a status, Jupiter's code (used to classify the failure)
    // and the signature; it shows people a friendly line, never this message.
    const { error: message, code, signature } = parsed;
    if (error.status === 429) return errorResponse(429, "Jupiter rate limit reached");
    if (error.status === 401 || error.status === 403)
      return errorResponse(502, "Jupiter rejected the server's API key");
    if (error.status >= 500)
      return errorResponse(502, message ?? "Jupiter is unavailable", { signature });
    return errorResponse(400, message ?? `Jupiter returned ${error.status}`, { code, signature });
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
