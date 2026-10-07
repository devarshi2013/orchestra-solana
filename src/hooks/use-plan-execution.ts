"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useRef, useState } from "react";

import { ApiError, assistantApi } from "@/lib/api-client";
import type { ExecutionView } from "@/lib/assistant/views";
import { base64ToBytes, bytesToBase64 } from "@/lib/solana";
import { classifyWalletError } from "@/lib/swap/errors";
import { isOrderExpired } from "@/lib/swap/quote";

/** Fresh orders per item when a quote expires mid-flow (the swap flow's re-quote). */
const MAX_ATTEMPTS = 3;
const POLL_MS = 5000;
const POLL_FOR_MS = 200_000;

export type ItemStep = "quoting" | "requoting" | "signing" | "sending" | "confirming";

export type PlanExecutionState =
  | { phase: "idle" }
  | { phase: "running"; index: number; step: ItemStep }
  | { phase: "finished" }
  | { phase: "stopped"; message: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : String(e);

/** Items a run (or a retry) buys: not bought yet, and not of unknown outcome. */
export const buyableIndexes = (execution: ExecutionView) =>
  execution.items
    .filter((i) => !i.outcomeUnknown && ["pending", "quoted", "failed"].includes(i.status))
    .map((i) => i.index);

/**
 * Buys a plan's items one at a time with the swap flow: fresh order (taker =
 * this wallet) → the wallet signs, never sends → re-quote if it expired while
 * the prompt was open → our server checks it's that order and sends it through
 * Jupiter's /execute. Each signature is a separate wallet prompt; nothing is
 * signed automatically. A failed item doesn't stop the others; declining in
 * the wallet stops the run.
 */
export function usePlanExecution(onExecution: (execution: ExecutionView) => void) {
  const { signTransaction } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<PlanExecutionState>({ phase: "idle" });
  const busy = useRef(false);

  const run = useCallback(
    async (initial: ExecutionView, indexes: number[]) => {
      if (busy.current) return;
      if (!signTransaction) {
        setState({ phase: "stopped", message: "This wallet can't sign transactions." });
        return;
      }
      busy.current = true;
      let execution = initial;
      const update = (next: ExecutionView) => {
        execution = next;
        onExecution(next);
      };
      const item = (index: number) => execution.items.find((i) => i.index === index)!;

      try {
        for (const index of indexes) {
          let settled = false;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS && !settled; attempt++) {
            setState({ phase: "running", index, step: attempt === 1 ? "quoting" : "requoting" });
            const prepared = await assistantApi.prepareItem(execution.id, index);
            update(prepared.execution);
            if (prepared.status === "failed") {
              settled = true;
              break;
            }

            setState({ phase: "running", index, step: "signing" });
            let signed: VersionedTransaction;
            try {
              signed = await signTransaction(
                VersionedTransaction.deserialize(base64ToBytes(prepared.order.transaction)),
              );
            } catch (error) {
              const reason = classifyWalletError(error).message;
              update(await assistantApi.abandonItem(execution.id, index, reason));
              setState({
                phase: "stopped",
                message: `${reason} ${item(index).symbol} and anything after it weren't bought.`,
              });
              return;
            }
            // The wallet prompt may have outlived the quote: get a fresh one.
            const blockHeight = await connection.getBlockHeight("confirmed").catch(() => undefined);
            if (isOrderExpired(prepared.order, { now: Date.now(), blockHeight })) continue;

            setState({ phase: "running", index, step: "sending" });
            const executed = await assistantApi.executeItem(
              execution.id,
              index,
              bytesToBase64(signed.serialize()),
            );
            update(executed.execution);
            if (executed.outcome === "succeeded" || executed.outcome === "failed") settled = true;
            else if (executed.outcome === "unknown") {
              setState({ phase: "running", index, step: "confirming" });
              const deadline = Date.now() + POLL_FOR_MS;
              while (Date.now() < deadline && item(index).status === "executing") {
                await sleep(POLL_MS);
                update(await assistantApi.execution(execution.id));
              }
              settled = true;
            }
            // "requote": loop for a fresh order.
          }
          if (!settled) {
            update(
              await assistantApi.abandonItem(
                execution.id,
                index,
                "The quote kept expiring before it could be sent. Retry and approve the wallet prompt promptly.",
              ),
            );
          }
        }
        setState({ phase: "finished" });
      } catch (error) {
        setState({ phase: "stopped", message: messageOf(error) });
        await assistantApi
          .execution(execution.id)
          .then(update)
          .catch(() => {});
      } finally {
        busy.current = false;
      }
    },
    [connection, onExecution, signTransaction],
  );

  return { state, run, running: state.phase === "running" };
}
