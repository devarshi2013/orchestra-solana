import "server-only";

import { executeResponseSchema, orderResponseSchema } from "@/lib/jupiter/schemas";
import type { ExecuteBody, OrderQuery } from "@/lib/swap/requests";

import { jupiterFetch } from "./client";

/** `amount` is in the input token's smallest units; without a taker Jupiter returns a quote only (transaction: null). */
export type OrderParams = OrderQuery;

/** GET /swap/v2/order with no optional routing params, so all routers compete ("ultra" mode). */
export async function getOrder(params: OrderParams, signal?: AbortSignal) {
  const response = await jupiterFetch("swap/v2/order", { query: params, signal });
  return orderResponseSchema.parse(await response.json());
}

export async function executeOrder(body: ExecuteBody) {
  const response = await jupiterFetch("swap/v2/execute", { method: "POST", body });
  return executeResponseSchema.parse(await response.json());
}
