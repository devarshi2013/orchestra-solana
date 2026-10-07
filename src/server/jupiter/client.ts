import "server-only";

import { serverEnv } from "@/env/server";

/**
 * The single place that attaches the Jupiter API key. Route handlers under
 * src/app/api/* call this; the browser never talks to api.jup.ag directly.
 * Endpoint wrappers (swap/price/tokens) will be added on top of this — see
 * docs/jupiter-api.md for the request/response shapes.
 */

export class JupiterApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    /** x-api-gateway-request-id: quote this when contacting Jupiter support. */
    readonly requestId: string | null,
  ) {
    super(
      `Jupiter API ${status}${requestId ? ` (request ${requestId})` : ""}: ${body.slice(0, 500)}`,
    );
    this.name = "JupiterApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined>;

export function buildJupiterUrl(baseUrl: string, path: string, query?: Query): URL {
  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

export async function jupiterFetch(
  path: string,
  init: { method?: "GET" | "POST"; query?: Query; body?: unknown; signal?: AbortSignal } = {},
): Promise<Response> {
  const { method = "GET", query, body, signal } = init;
  const headers: HeadersInit = {
    "x-api-key": serverEnv.JUPITER_API_KEY,
    accept: "application/json",
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(buildJupiterUrl(serverEnv.JUPITER_API_BASE_URL, path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new JupiterApiError(
      response.status,
      await response.text(),
      response.headers.get("x-api-gateway-request-id"),
    );
  }
  return response;
}
