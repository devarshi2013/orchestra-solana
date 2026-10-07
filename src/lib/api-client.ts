import { z } from "zod";

import {
  executeResponseSchema,
  orderResponseSchema,
  type ExecuteResponse,
  type OrderResponse,
} from "@/lib/jupiter/schemas";
import type { Asset } from "@/lib/assets/registry";
import type { ItemQuote } from "@/lib/assistant/review";
import type { CreateExecution } from "@/lib/assistant/schemas";
import type {
  ConversationSummary,
  ExecutedItem,
  ExecutionView,
  PreparedItem,
  TranscriptTurn,
} from "@/lib/assistant/views";
import type { CreateInvestment } from "@/lib/invest/schemas";
import type { IndicativeQuote, InvestmentView, RunView, SnapshotView } from "@/lib/invest/views";
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

// --- Wallet sign-in and investments (session cookie; same-origin) -----------

/** Our own API's JSON, typed by the route; not re-validated. */
const trusted = <T>() => z.custom<T>(() => true);
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const authApi = {
  session: () => request("/api/auth/session", {}, trusted<{ wallet: string | null }>()),
  challenge: (address: string) =>
    request(
      `/api/auth/challenge?address=${encodeURIComponent(address)}`,
      {},
      trusted<{ message: string }>(),
    ),
  verify: (address: string, signature: string) =>
    request(
      "/api/auth/verify",
      json("POST", { address, signature }),
      trusted<{ wallet: string }>(),
    ),
  signOut: () => request("/api/auth/session", json("DELETE"), trusted<{ wallet: null }>()),
};

export type PreparedLegResponse =
  | { status: "skipped"; reason: string; run: RunView }
  | { status: "failed"; reason: string; run: RunView }
  | {
      status: "quoted";
      run: RunView;
      order: {
        transaction: string;
        requestId: string;
        expireAt?: string | null;
        lastValidBlockHeight?: string | null;
      };
    };

export type ExecutedLegResponse = {
  outcome: "succeeded" | "failed" | "requote" | "unknown";
  message?: string;
  run: RunView;
};

export const investApi = {
  list: () => request("/api/investments", {}, trusted<InvestmentView[]>()),
  create: (body: CreateInvestment) =>
    request("/api/investments", json("POST", body), trusted<InvestmentView>()),
  get: (id: string) =>
    request(`/api/investments/${id}`, {}, trusted<InvestmentView & { runs: RunView[] }>()),
  update: (
    id: string,
    body: Partial<
      Pick<InvestmentView, "status" | "rebalance" | "driftThresholdPct" | "notifyEmail">
    >,
  ) => request(`/api/investments/${id}`, json("PATCH", body), trusted<InvestmentView>()),
  portfolio: (id: string, signal?: AbortSignal) =>
    request(`/api/investments/${id}/portfolio`, { signal }, trusted<SnapshotView>()),
  openRun: (id: string) =>
    request(`/api/investments/${id}/runs`, {}, trusted<{ open: RunView | null }>()),
  planRun: (id: string) =>
    request(
      `/api/investments/${id}/runs`,
      json("POST"),
      trusted<{ run: RunView | null; snapshot: SnapshotView }>(),
    ),
  run: (runId: string) => request(`/api/runs/${runId}`, {}, trusted<RunView>()),
  cancelRun: (runId: string) =>
    request(`/api/runs/${runId}`, json("PATCH", { action: "cancel" }), trusted<RunView>()),
  quotes: (runId: string) =>
    request(`/api/runs/${runId}/quotes`, {}, trusted<{ quotes: IndicativeQuote[] }>()),
  prepareLeg: (runId: string, index: number) =>
    request(
      `/api/runs/${runId}/legs/${index}`,
      json("POST", { action: "prepare" }),
      trusted<PreparedLegResponse>(),
    ),
  executeLeg: (runId: string, index: number, signedTransaction: string) =>
    request(
      `/api/runs/${runId}/legs/${index}`,
      json("POST", { action: "execute", signedTransaction }),
      trusted<ExecutedLegResponse>(),
    ),
  abandonLeg: (runId: string, index: number, reason: string) =>
    request(
      `/api/runs/${runId}/legs/${index}`,
      json("POST", { action: "abandon", reason }),
      trusted<{ run: RunView }>(),
    ),
  notifications: () =>
    request(
      "/api/notifications",
      {},
      trusted<{
        notifications: {
          id: string;
          title: string;
          body: string;
          url: string;
          investmentId: string | null;
        }[];
        partial: { id: string; investmentId: string; investment: { name: string } }[];
      }>(),
    ),
  dismissNotification: (id: string) =>
    request("/api/notifications", json("PATCH", { id }), trusted<{ ok: true }>()),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    request("/api/push/subscriptions", json("POST", subscription), trusted<{ ok: true }>()),
};

// --- Asset registry ------------------------------------------------------------

export type RegistryView = { builtAt: string; stocks: Asset[]; crypto: Asset[] };
export type LiquidityCheck =
  | { status: "ok" | "thin"; impactPct: number; router: string; testUsd: number }
  | { status: "no_route"; message: string; testUsd: number };

export const assetsApi = {
  registry: (signal?: AbortSignal) => request("/api/assets", { signal }, trusted<RegistryView>()),
  prices: (kind: "stock" | "crypto", signal?: AbortSignal) =>
    request(
      `/api/assets/prices?kind=${kind}`,
      { signal },
      trusted<Record<string, { usdPrice: number; priceChange24h: number | null }>>(),
    ),
  liquidity: (mint: string, signal?: AbortSignal) =>
    request(
      `/api/assets/liquidity?mint=${encodeURIComponent(mint)}`,
      { signal },
      trusted<LiquidityCheck>(),
    ),
};

export const assistantApi = {
  disclosure: () =>
    request("/api/assistant/disclosure", {}, trusted<{ accepted: boolean; version: number }>()),
  acceptDisclosure: () =>
    request(
      "/api/assistant/disclosure",
      json("POST"),
      trusted<{ accepted: boolean; version: number }>(),
    ),
  balances: (signal?: AbortSignal) =>
    request(
      "/api/assistant/balances",
      { signal },
      trusted<{ usdc: number | null; sol: number | null; reason: string | null }>(),
    ),
  quote: (body: { symbol: string; usdcAmount: number }, signal?: AbortSignal) =>
    request("/api/assistant/quote", { ...json("POST", body), signal }, trusted<ItemQuote>()),
  conversations: () =>
    request("/api/assistant/conversations", {}, trusted<ConversationSummary[]>()),
  conversation: (id: string) =>
    request(
      `/api/assistant/conversations/${id}`,
      {},
      trusted<{ id: string; turns: TranscriptTurn[]; executions: number }>(),
    ),
  executions: () => request("/api/assistant/executions", {}, trusted<ExecutionView[]>()),
  execution: (id: string) =>
    request(`/api/assistant/executions/${id}`, {}, trusted<ExecutionView>()),
  createExecution: (body: CreateExecution) =>
    request("/api/assistant/executions", json("POST", body), trusted<ExecutionView>()),
  prepareItem: (id: string, index: number) =>
    request(
      `/api/assistant/executions/${id}/items/${index}`,
      json("POST", { action: "prepare" }),
      trusted<PreparedItem>(),
    ),
  executeItem: (id: string, index: number, signedTransaction: string) =>
    request(
      `/api/assistant/executions/${id}/items/${index}`,
      json("POST", { action: "execute", signedTransaction }),
      trusted<ExecutedItem>(),
    ),
  abandonItem: (id: string, index: number, reason: string) =>
    request(
      `/api/assistant/executions/${id}/items/${index}`,
      json("POST", { action: "abandon", reason }),
      trusted<ExecutionView>(),
    ),
};
