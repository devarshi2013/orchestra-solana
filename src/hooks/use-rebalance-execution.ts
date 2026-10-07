"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useRef, useState } from "react";

import { ApiError, investApi } from "@/lib/api-client";
import { nextLegIndex } from "@/lib/invest/run-state";
import type { RunView } from "@/lib/invest/views";
import { base64ToBytes, bytesToBase64 } from "@/lib/solana";
import { classifyWalletError } from "@/lib/swap/errors";
import { isOrderExpired } from "@/lib/swap/quote";

/** Fresh quotes per leg before giving up (each one expires within about a minute). */
const MAX_QUOTES_PER_LEG = 3;
const POLL_MS = 5000;
const POLL_FOR_MS = 200_000;

export type ExecutionState =
  | { phase: "idle" }
  | { phase: "running"; legIndex: number; step: "quoting" | "signing" | "sending" | "confirming" }
  | { phase: "stopped"; message: string }
  | { phase: "done" };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : String(e);

/**
 * Runs a rebalance's legs one by one: fresh order from live balances → wallet
 * signs (never sends) → our server checks it and sends it through Jupiter's
 * /execute → next leg. Stops on the first failure or decline, leaving the run
 * resumable from that leg.
 */
export function useRebalanceExecution(onRun: (run: RunView) => void) {
  const { signTransaction } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<ExecutionState>({ phase: "idle" });
  const busy = useRef(false);

  const execute = useCallback(
    async (initial: RunView) => {
      if (busy.current) return;
      if (!signTransaction) {
        setState({ phase: "stopped", message: "This wallet can't sign transactions." });
        return;
      }
      busy.current = true;
      let run = initial;
      const update = (next: RunView) => {
        run = next;
        onRun(next);
      };
      const stop = (message: string) => setState({ phase: "stopped", message });

      try {
        for (let index = nextLegIndex(run.legs); index !== null; index = nextLegIndex(run.legs)) {
          let settled = false;
          for (let attempt = 1; attempt <= MAX_QUOTES_PER_LEG && !settled; attempt++) {
            setState({ phase: "running", legIndex: index, step: "quoting" });
            const prepared = await investApi.prepareLeg(run.id, index);
            update(prepared.run);
            if (prepared.status === "skipped") {
              settled = true;
              break;
            }
            if (prepared.status === "failed") return stop(prepared.reason);

            setState({ phase: "running", legIndex: index, step: "signing" });
            let signed: VersionedTransaction;
            try {
              signed = await signTransaction(
                VersionedTransaction.deserialize(base64ToBytes(prepared.order.transaction)),
              );
            } catch (error) {
              const reason = classifyWalletError(error).message;
              update((await investApi.abandonLeg(run.id, index, reason)).run);
              return stop(reason);
            }
            // The wallet prompt may have outlived the quote.
            const blockHeight = await connection.getBlockHeight("confirmed").catch(() => undefined);
            if (isOrderExpired(prepared.order, { now: Date.now(), blockHeight })) continue;

            setState({ phase: "running", legIndex: index, step: "sending" });
            const executed = await investApi.executeLeg(
              run.id,
              index,
              bytesToBase64(signed.serialize()),
            );
            update(executed.run);
            if (executed.outcome === "succeeded") settled = true;
            else if (executed.outcome === "failed")
              return stop(executed.message ?? "The swap failed.");
            else if (executed.outcome === "unknown") {
              setState({ phase: "running", legIndex: index, step: "confirming" });
              const deadline = Date.now() + POLL_FOR_MS;
              while (Date.now() < deadline) {
                await sleep(POLL_MS);
                update(await investApi.run(run.id));
                const leg = run.legs.find((l) => l.index === index)!;
                if (leg.status !== "executing") break;
              }
              const leg = run.legs.find((l) => l.index === index)!;
              if (leg.status !== "succeeded") {
                return stop(
                  leg.error ?? "We couldn't confirm this swap yet. Reopen this page in a minute.",
                );
              }
              settled = true;
            }
            // "requote": loop for a fresh order.
          }
          if (!settled)
            return stop("The quote kept expiring before it could be sent. Resume to try again.");
        }
        setState({ phase: "done" });
      } catch (error) {
        stop(messageOf(error));
        await investApi
          .run(run.id)
          .then(update)
          .catch(() => {});
      } finally {
        busy.current = false;
      }
    },
    [connection, onRun, signTransaction],
  );

  return { state, execute, running: state.phase === "running" };
}
