import "server-only";

import {
  executeResponseSchema,
  orderResponseSchema,
  type ExecuteResponse,
  type OrderResponse,
} from "@/lib/jupiter/schemas";

import { jupiterFetch } from "./client";

export type OrderParams = {
  inputMint: string;
  outputMint: string;
  /** Smallest units of the input token. */
  amount: string;
  /** Without a taker Jupiter returns a quote only (transaction: null). */
  taker?: string;
};

/**
 * GET /swap/v2/order with no optional routing params, so all routers compete
 * ("ultra" mode). 429s are retried here unless `retryRateLimit: false` (the
 * browser's buy flow retries itself, showing "Retrying…").
 */
export async function getOrder(
  params: OrderParams,
  signal?: AbortSignal,
  options: { retryRateLimit?: boolean } = {},
): Promise<OrderResponse> {
  const response = await jupiterFetch("swap/v2/order", { query: params, signal, ...options });
  return orderResponseSchema.parse(await response.json());
}

export async function executeOrder(body: {
  signedTransaction: string;
  requestId: string;
}): Promise<ExecuteResponse> {
  const response = await jupiterFetch("swap/v2/execute", { method: "POST", body });
  return executeResponseSchema.parse(await response.json());
}
