import "server-only";

import { serverEnv } from "@/env/server";
import { MAX_RATE_LIMIT_RETRIES, retryDelayMs } from "@/lib/friendly-error";

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
  init: {
    method?: "GET" | "POST";
    query?: Query;
    body?: unknown;
    signal?: AbortSignal;
    /**
     * Retry a 429 up to 3 times (after 1 s, 2 s, 4 s) before giving up. On by
     * default; routes whose caller retries itself (and shows "Retrying…") turn it off.
     */
    retryRateLimit?: boolean;
  } = {},
): Promise<Response> {
  const { method = "GET", query, body, signal, retryRateLimit = true } = init;
  const headers: HeadersInit = {
    // Server-side only: the key never reaches the browser.
    "x-api-key": serverEnv.JUPITER_API_KEY,
    accept: "application/json",
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  const url = buildJupiterUrl(serverEnv.JUPITER_API_BASE_URL, path, query);

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      method,
      headers,
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
      `[jupiter] ${method} ${path} → ${error.status} request=${error.requestId ?? "-"} attempt=${attempt + 1} body=${error.body.slice(0, 500)}`,
    );
    if (error.status !== 429 || !retryRateLimit || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;
    await sleep(retryDelayMs(attempt + 1), signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
