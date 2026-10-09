"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useRef, useState } from "react";

import { ApiError, executeSwap, fetchOrder } from "@/lib/api-client";
import { base64ToBytes, bytesToBase64 } from "@/lib/solana";
import {
  classifyApiError,
  classifyExecuteResult,
  classifyOrderError,
  classifyWalletError,
} from "@/lib/swap/errors";
import { isOrderExpired } from "@/lib/swap/quote";
import { USDC_MINT } from "@/lib/tokens";
import { toBaseUnits, USDC_DECIMALS } from "@/lib/units";

/** Fresh orders per item when a quote expires before it lands. */
const MAX_ATTEMPTS = 3;

export type BuyStep = "waiting" | "quoting" | "signing" | "sending" | "bought" | "failed";

export type BuyItem = {
  symbol: string;
  name: string;
  /** From the asset registry (never from the model). */
  mint: string;
  decimals: number;
  usdcAmount: number;
  step: BuyStep;
  /** Transaction signature, once sent (also for a failed swap that landed). */
  signature: string | null;
  /** Tokens received, base units. */
  outAmount: string | null;
  error: string | null;
};

const message = (error: unknown) =>
  (error instanceof ApiError
    ? classifyApiError(error)
    : classifyApiError({
        status: 500,
        message: error instanceof Error ? error.message : String(error),
      })
  ).message;

/**
 * Buys a plan's items one at a time with the same flow as /swap: a fresh
 * Jupiter order for this wallet → the wallet signs (never sends) → re-quote if
 * the quote expired while the prompt was open → our /api/swap/execute lands
 * it. Every buy is its own wallet prompt; nothing is signed automatically. A
 * failed item doesn't stop the others; declining in the wallet stops the run.
 */
export function usePlanBuy() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [items, setItems] = useState<BuyItem[] | null>(null);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<string | null>(null);
  const busy = useRef(false);

  const run = useCallback(
    async (start: BuyItem[]) => {
      if (busy.current || !publicKey) return;
      if (!signTransaction) {
        setStopped("This wallet can't sign transactions.");
        return;
      }
      busy.current = true;
      setRunning(true);
      setStopped(null);
      let current = start;
      const update = (index: number, change: Partial<BuyItem>) => {
        current = current.map((item, i) => (i === index ? { ...item, ...change } : item));
        setItems(current);
      };
      setItems(current);

      try {
        for (let index = 0; index < current.length; index++) {
          const item = current[index]!;
          if (item.step === "bought") continue;
          let done = false;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS && !done; attempt++) {
            update(index, { step: "quoting", error: null });
            let order;
            try {
              order = await fetchOrder({
                inputMint: USDC_MINT,
                outputMint: item.mint,
                amount: toBaseUnits(item.usdcAmount, USDC_DECIMALS).toString(),
                taker: publicKey.toBase58(),
              });
            } catch (error) {
              update(index, { step: "failed", error: message(error) });
              break;
            }
            if (!order.transaction) {
              const reason = classifyOrderError(order);
              update(index, { step: "failed", error: `${reason.title}: ${reason.message}` });
              break;
            }

            update(index, { step: "signing" });
            let signed: VersionedTransaction;
            try {
              signed = await signTransaction(
                VersionedTransaction.deserialize(base64ToBytes(order.transaction)),
              );
            } catch (error) {
              const reason = classifyWalletError(error);
              update(index, { step: "failed", error: reason.message });
              setStopped(`${reason.message} ${item.symbol} and anything after it weren't bought.`);
              return;
            }
            // The wallet prompt may have outlived the quote: get a fresh one.
            const blockHeight = await connection.getBlockHeight("confirmed").catch(() => undefined);
            if (isOrderExpired(order, { now: Date.now(), blockHeight })) continue;

            update(index, { step: "sending" });
            try {
              const result = await executeSwap({
                signedTransaction: bytesToBase64(signed.serialize()),
                requestId: order.requestId,
              });
              if (result.status === "Success") {
                update(index, {
                  step: "bought",
                  signature: result.signature ?? null,
                  outAmount: result.totalOutputAmount ?? order.outAmount,
                });
                done = true;
                continue;
              }
              const reason = classifyExecuteResult(result);
              if (reason.kind === "expired") continue;
              update(index, {
                step: "failed",
                signature: result.signature ?? null,
                error: `${reason.title}: ${reason.message}`,
              });
              break;
            } catch (error) {
              const reason = error instanceof ApiError ? classifyApiError(error) : null;
              if (reason?.kind === "expired") continue;
              update(index, { step: "failed", error: message(error) });
              break;
            }
          }
          if (!done && current[index]!.step !== "failed") {
            update(index, {
              step: "failed",
              error: "The quote kept expiring before it could be sent. Retry and approve promptly.",
            });
          }
        }
      } finally {
        busy.current = false;
        setRunning(false);
      }
    },
    [connection, publicKey, signTransaction],
  );

  /** Buys the items again that weren't bought (failed or never reached). */
  const retry = useCallback(() => {
    if (items) void run(items.map((i) => (i.step === "bought" ? i : { ...i, step: "waiting" })));
  }, [items, run]);

  return { items, running, stopped, run, retry };
}
