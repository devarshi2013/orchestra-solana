import { z } from "zod";

import {
  executeResponseSchema,
  orderResponseSchema,
  type ExecuteResponse,
  type OrderResponse,
} from "@/lib/jupiter/schemas";
import type { MarketData } from "@/lib/symphony/market-data";
import { symphonySchema } from "@/lib/symphony/schema";
import type { Symphony } from "@/lib/symphony/types";
import type { ExecuteBody, OrderQuery } from "@/lib/swap/requests";
import { tokenInfoSchema, type TokenInfo } from "@/lib/tokens";

/** Browser → our /api routes. Never calls Jupiter directly (the API key lives server-side). */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: number,
    readonly signature?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const errorBodySchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number().optional(),
    signature: z.string().optional(),
  }),
});

async function request<T>(input: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(0, "Network error");
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorBodySchema.safeParse(json);
    if (parsed.success) {
      const { message, code, signature } = parsed.data.error;
      throw new ApiError(response.status, message, code, signature);
    }
    throw new ApiError(response.status, `Request failed (${response.status})`);
  }
  return schema.parse(json);
}

export function fetchOrder(query: OrderQuery, signal?: AbortSignal): Promise<OrderResponse> {
  const params = new URLSearchParams({
    inputMint: query.inputMint,
    outputMint: query.outputMint,
    amount: query.amount,
  });
  if (query.taker) params.set("taker", query.taker);
  return request(`/api/swap/order?${params}`, { signal }, orderResponseSchema);
}

export function executeSwap(body: ExecuteBody): Promise<ExecuteResponse> {
  return request(
    "/api/swap/execute",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    executeResponseSchema,
  );
}

export function searchTokens(query: string, signal?: AbortSignal): Promise<TokenInfo[]> {
  return request(
    `/api/tokens/search?${new URLSearchParams({ query })}`,
    { signal },
    z.array(tokenInfoSchema),
  );
}

const marketDataSchema: z.ZodType<MarketData> = z.object({
  dates: z.array(z.string()),
  closes: z.record(z.string(), z.array(z.number().nullable())),
});

/** Stored daily closes for `mints`, aligned on one date axis. */
export function fetchMarketData(
  mints: readonly string[],
  signal?: AbortSignal,
): Promise<MarketData> {
  const params = new URLSearchParams({ mints: mints.join(",") });
  return request(`/api/market-data?${params}`, { signal }, marketDataSchema);
}

export type SavedDraft = { id: string; updatedAt: string };

const savedDraftSchema: z.ZodType<SavedDraft> = z.object({ id: z.string(), updatedAt: z.string() });
const draftSchema = z.object({ id: z.string(), symphony: symphonySchema, updatedAt: z.string() });

/** A draft saved from /create, by its id. */
export function fetchDraft(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string; symphony: Symphony; updatedAt: string }> {
  return request(`/api/drafts/${encodeURIComponent(id)}`, { signal }, draftSchema);
}

export function saveDraft(
  id: string,
  symphony: Symphony,
  signal?: AbortSignal,
): Promise<SavedDraft> {
  return request(
    `/api/drafts/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symphony }),
      signal,
    },
    savedDraftSchema,
  );
}
