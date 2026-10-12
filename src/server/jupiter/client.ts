import "server-only";

import { serverEnv } from "@/env";

/**
 * The single place that attaches the Jupiter API key. Route handlers under
 * src/app/api/* call this; the browser never talks to api.jup.ag directly.
 * Response shapes are in src/lib/jupiter/schemas.ts.
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

function buildJupiterUrl(baseUrl: string, path: string, query: Query = {}): URL {
  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

/**
 * One request to Jupiter with the server's API key. A non-2xx answer (429
 * included) is logged and thrown as JupiterApiError; nothing is retried.
 */
export async function jupiterFetch(
  path: string,
  init: { method?: "GET" | "POST"; query?: Query; body?: unknown; signal?: AbortSignal } = {},
): Promise<Response> {
  const { method = "GET", query, body, signal } = init;
  const response = await fetch(buildJupiterUrl(serverEnv.JUPITER_API_BASE_URL, path, query), {
    method,
    headers: {
      // Server-side only: the key never reaches the browser.
      "x-api-key": serverEnv.JUPITER_API_KEY,
      accept: "application/json",
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  if (response.ok) return response;
  const error = new JupiterApiError(
    response.status,
    await response.text(),
    response.headers.get("x-api-gateway-request-id"),
  );
  // Full details for us (server logs only); people see a friendly line.
  console.error(
    `[jupiter] ${method} ${path} → ${error.status} request=${error.requestId ?? "-"} body=${error.body.slice(0, 500)}`,
  );
  throw error;
}
