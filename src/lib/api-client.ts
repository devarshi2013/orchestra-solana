import { z } from "zod";

import {
  executeResponseSchema,
  orderResponseSchema,
  type ExecuteResponse,
  type OrderResponse,
} from "@/lib/jupiter/schemas";
import type { Asset } from "@/lib/assets/registry";
import type { ItemQuote } from "@/lib/assistant/review";
import type { ExecuteBody, OrderQuery } from "@/lib/swap/requests";

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

const trusted = <T>() => z.custom<T>(() => true);
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export type RegistryView = { builtAt: string; stocks: Asset[]; crypto: Asset[] };

export const assetsApi = {
  registry: (signal?: AbortSignal) => request("/api/assets", { signal }, trusted<RegistryView>()),
};

export const assistantApi = {
  balances: (wallet: string, signal?: AbortSignal) =>
    request(
      `/api/assistant/balances?${new URLSearchParams({ wallet })}`,
      { signal },
      trusted<{ usdc: number | null; sol: number | null; reason: string | null }>(),
    ),
  quote: (body: { wallet: string; symbol: string; usdcAmount: number }, signal?: AbortSignal) =>
    request("/api/assistant/quote", { ...json("POST", body), signal }, trusted<ItemQuote>()),
};
