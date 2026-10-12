import { z } from "zod";

import { executeResponseSchema, orderResponseSchema } from "@/lib/jupiter/schemas";
import type { ItemQuote } from "@/lib/assistant/review";
import type {
  Fill,
  HistoryPeriod,
  MeResponse,
  NewStrategy,
  PortfolioHistoryResponse,
  PricesResponse,
  ProfileResponse,
  Strategy,
} from "@/lib/strategies/types";
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

/** Error envelope returned by every /api route (built by server/http.ts). */
const apiErrorBodySchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number().optional(),
    signature: z.string().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

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
    const parsed = apiErrorBodySchema.safeParse(json);
    if (parsed.success) {
      const { message, code, signature } = parsed.data.error;
      throw new ApiError(response.status, message, code, signature);
    }
    throw new ApiError(response.status, `Request failed (${response.status})`);
  }
  return schema.parse(json);
}

const trusted = <T>() => z.custom<T>(() => true);
const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function fetchOrder(
  { inputMint, outputMint, amount, taker }: OrderQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ inputMint, outputMint, amount, ...(taker && { taker }) });
  return request(`/api/swap/order?${params}`, { signal }, orderResponseSchema);
}

export const executeSwap = (body: ExecuteBody) =>
  request("/api/swap/execute", post(body), executeResponseSchema);

/** Solana's confirmed block height, read by the server (browsers are refused by public RPCs). */
export const fetchBlockHeight = () =>
  request("/api/solana/block-height", {}, z.object({ blockHeight: z.number() })).then(
    (body) => body.blockHeight,
  );

export const assistantApi = {
  balances: (wallet: string, signal?: AbortSignal) =>
    request(
      `/api/assistant/balances?${new URLSearchParams({ wallet })}`,
      { signal },
      trusted<{ usdc: number | null; sol: number | null; reason: string | null }>(),
    ),
  quote: (body: { wallet: string; symbol: string; usdcAmount: number }, signal?: AbortSignal) =>
    request("/api/assistant/quote", { ...post(body), signal }, trusted<ItemQuote>()),
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const done = () => undefined;

/** Wallet sign-in (session cookie). */
export const authApi = {
  nonce: (wallet: string) =>
    request(
      `/api/auth/nonce?${new URLSearchParams({ wallet })}`,
      {},
      trusted<{ nonce: string; message: string }>(),
    ),
  verify: (body: { wallet: string; signature: string; message: string }) =>
    request("/api/auth/verify", post(body), trusted<MeResponse>()),
  me: () => request("/api/auth/me", { cache: "no-store" }, trusted<MeResponse>()),
  logout: () => request("/api/auth/logout", json("POST"), trusted<unknown>()).then(done),
};

/** The signed-in wallet's strategies. */
export const strategiesApi = {
  list: () => request("/api/strategies", { cache: "no-store" }, trusted<Strategy[]>()),
  create: (body: NewStrategy) => request("/api/strategies", post(body), trusted<Strategy>()),
  update: (id: string, body: { status: "cancelled" | "watching" }) =>
    request(`/api/strategies/${encodeURIComponent(id)}`, json("PATCH", body), trusted<Strategy>()),
  remove: async (id: string) => {
    const response = await fetch(`/api/strategies/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status})`);
  },
};

/** The signed-in wallet's profile: positions, strategies, fills, notifications, webhook. */
export const profileApi = {
  get: () => request("/api/profile", { cache: "no-store" }, trusted<ProfileResponse>()),
  setWebhook: (url: string | null) =>
    request("/api/profile", json("PATCH", { webhookUrl: url }), trusted<unknown>()).then(done),
  markRead: (ids?: string[]) =>
    request("/api/profile/read", post(ids ? { ids } : {}), trusted<unknown>()).then(done),
};

/** Jupiter's live prices for up to 50 mints. */
export const portfolioApi = {
  history: (period: HistoryPeriod) =>
    request(
      `/api/portfolio/history?${new URLSearchParams({ period })}`,
      { cache: "no-store" },
      trusted<PortfolioHistoryResponse>(),
    ),
};

export const pricesApi = {
  get: (mints: string[]) =>
    request(
      `/api/prices?${new URLSearchParams({ mints: mints.join(",") })}`,
      {},
      trusted<PricesResponse>(),
    ),
};

/**
 * Records a swap the user just landed (the server reads it back from the
 * chain). Never throws: a failure is logged and gives null, so a buy that
 * landed is never reported as failed because recording it didn't work.
 */
export async function recordFill(
  signature: string,
  strategyId?: string | null,
): Promise<Fill | null> {
  try {
    return await request("/api/fills", post({ signature, strategyId }), trusted<Fill>());
  } catch (error) {
    console.error("[fills] couldn't record", signature, error);
    return null;
  }
}
