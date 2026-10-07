"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useRef, useState } from "react";

import { ApiError, executeSwap, fetchOrder } from "@/lib/api-client";
import type { ExecuteResponse, OrderResponse } from "@/lib/jupiter/schemas";
import { base64ToBytes, bytesToBase64 } from "@/lib/solana";
import {
  classifyApiError,
  classifyExecuteResult,
  classifyOrderError,
  classifyWalletError,
  type SwapError,
} from "@/lib/swap/errors";
import { isOrderExpired } from "@/lib/swap/quote";

/** Fresh order + signature attempts when a quote expires mid-flow. */
const MAX_ATTEMPTS = 3;

export type SwapPhase =
  | "idle"
  | "quoting" // GET /order with taker
  | "signing" // waiting on the wallet
  | "requoting" // previous quote expired; fetching a new one
  | "executing" // POST /execute, Jupiter landing the tx
  | "success"
  | "error";

export type SwapState = {
  phase: SwapPhase;
  attempt: number;
  order?: OrderResponse;
  result?: ExecuteResponse;
  error?: SwapError;
};

const toSwapError = (error: unknown): SwapError =>
  error instanceof ApiError
    ? classifyApiError(error)
    : classifyApiError({
        status: 500,
        message: error instanceof Error ? error.message : String(error),
      });

/**
 * Non-custodial swap: GET order (taker = wallet) → deserialize → wallet.signTransaction
 * → POST execute. The wallet only signs; Jupiter's /execute lands the transaction
 * (RFQ routes get the market maker's co-signature there).
 */
export function useSwap() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [state, setState] = useState<SwapState>({ phase: "idle", attempt: 0 });
  const busy = useRef(false);

  const swap = useCallback(
    async (params: { inputMint: string; outputMint: string; amount: string }) => {
      if (busy.current) return;
      if (!publicKey) return;
      if (!signTransaction) {
        setState({
          phase: "error",
          attempt: 0,
          error: classifyWalletError(new Error("This wallet can't sign transactions.")),
        });
        return;
      }
      busy.current = true;
      const fail = (error: SwapError, order?: OrderResponse) =>
        setState((s) => ({ ...s, phase: "error", error, order: order ?? s.order }));

      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          setState({ phase: attempt === 1 ? "quoting" : "requoting", attempt });

          // 1. Fresh order with taker → assembled, unsigned transaction.
          let order: OrderResponse;
          try {
            order = await fetchOrder({ ...params, taker: publicKey.toBase58() });
          } catch (error) {
            return fail(toSwapError(error));
          }
          if (!order.transaction) {
            return fail(
              order.transaction === ""
                ? classifyOrderError(order)
                : toSwapError(new Error("Jupiter returned no transaction.")),
              order,
            );
          }

          let transaction: VersionedTransaction;
          try {
            transaction = VersionedTransaction.deserialize(base64ToBytes(order.transaction));
          } catch {
            return fail(
              toSwapError(new Error("Couldn't decode the transaction from Jupiter.")),
              order,
            );
          }

          // 2. Sign only — never send from the wallet.
          setState({ phase: "signing", attempt, order });
          let signed: VersionedTransaction;
          try {
            signed = await signTransaction(transaction);
          } catch (error) {
            return fail(classifyWalletError(error), order);
          }

          // The user may have sat on the wallet prompt past the quote's expiry.
          const blockHeight = await connection.getBlockHeight("confirmed").catch(() => undefined);
          if (isOrderExpired(order, { now: Date.now(), blockHeight })) continue;

          // 3. Execute via our API → Jupiter lands and confirms it.
          setState({ phase: "executing", attempt, order });
          let result: ExecuteResponse;
          try {
            result = await executeSwap({
              signedTransaction: bytesToBase64(signed.serialize()),
              requestId: order.requestId,
            });
          } catch (error) {
            const swapError = toSwapError(error);
            if (swapError.kind === "expired") continue;
            return fail(swapError, order);
          }

          if (result.status === "Success") {
            setState({ phase: "success", attempt, order, result });
            return;
          }
          const swapError = classifyExecuteResult(result);
          if (swapError.kind === "expired") continue;
          setState({ phase: "error", attempt, order, result, error: swapError });
          return;
        }
        fail({
          kind: "expired",
          title: "Quote kept expiring",
          message: `The quote expired ${MAX_ATTEMPTS} times before it could be sent. Try again and approve the wallet prompt promptly.`,
        });
      } finally {
        busy.current = false;
      }
    },
    [connection, publicKey, signTransaction],
  );

  const reset = useCallback(() => setState({ phase: "idle", attempt: 0 }), []);

  const inFlight =
    state.phase === "quoting" ||
    state.phase === "signing" ||
    state.phase === "requoting" ||
    state.phase === "executing";

  return { state, swap, reset, inFlight };
}
