"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useRef, useState } from "react";

import { ApiError, executeSwap, fetchOrder } from "@/lib/api-client";
import {
  friendlyError,
  friendlyKind,
  MAX_RATE_LIMIT_RETRIES,
  retryDelayMs,
} from "@/lib/friendly-error";
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

export type BuyStep =
  "waiting" | "quoting" | "retrying" | "signing" | "sending" | "bought" | "failed";

export type BuyItem = {
  symbol: string;
  name: string;
  /** From the stock registry via the server's quote (never from the model). */
  mint: string;
  decimals: number;
  usdcAmount: number;
  step: BuyStep;
  /** Transaction signature, once sent (also for a failed swap that landed). */
  signature: string | null;
  /** Tokens received, base units. */
  outAmount: string | null;
  /** One friendly sentence (lib/friendly-error.ts); never a raw API error. */
  error: string | null;
};

/**
 * Logs the technical details (dev console only) and returns the friendly line;
 * `classified` is what to explain it by when it was already classified.
 */
const fail = (symbol: string, stage: string, error: unknown, classified?: unknown) => {
  console.error(`[buy] ${symbol} ${stage} failed`, error);
  return friendlyError(classified ?? (error instanceof ApiError ? classifyApiError(error) : error));
};

/**
 * Buys a plan's items one at a time: a fresh
 * Jupiter order for this wallet → the wallet signs (never sends) → re-quote if
 * the quote expired while the prompt was open → our /api/swap/execute lands
 * it. Every buy is its own wallet prompt; nothing is signed automatically. A
 * failed item doesn't stop the others; declining in the wallet stops the run.
 */
export function usePlanBuy(saved?: { items: BuyItem[]; stopped: string | null }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  // A reopened chat starts from its saved purchase (statuses and Solscan links).
  const [items, setItems] = useState<BuyItem[] | null>(saved?.items ?? null);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<string | null>(saved?.stopped ?? null);
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
            // A rate limit is retried up to 3 times (1 s, 2 s, 4 s), showing "Retrying…".
            for (let retry = 0; ; retry++) {
              try {
                order = await fetchOrder({
                  inputMint: USDC_MINT,
                  outputMint: item.mint,
                  amount: toBaseUnits(item.usdcAmount, USDC_DECIMALS).toString(),
                  taker: publicKey.toBase58(),
                });
                break;
              } catch (error) {
                if (friendlyKind(error) !== "rate_limited" || retry >= MAX_RATE_LIMIT_RETRIES) {
                  update(index, { step: "failed", error: fail(item.symbol, "order", error) });
                  break;
                }
                console.error(`[buy] ${item.symbol} order rate-limited, retrying`, error);
                update(index, { step: "retrying" });
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs(retry + 1)));
              }
            }
            if (!order) break;
            if (!order.transaction) {
              update(index, {
                step: "failed",
                error: fail(item.symbol, "build", order, classifyOrderError(order)),
              });
              break;
            }

            update(index, { step: "signing" });
            let signed: VersionedTransaction;
            try {
              signed = await signTransaction(
                VersionedTransaction.deserialize(base64ToBytes(order.transaction)),
              );
            } catch (error) {
              const friendly = fail(item.symbol, "sign", error, classifyWalletError(error));
              update(index, { step: "failed", error: friendly });
              setStopped(friendly);
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
              console.error(`[buy] ${item.symbol} execute failed`, result);
              update(index, {
                step: "failed",
                signature: result.signature ?? null,
                error: friendlyError(reason),
              });
              break;
            } catch (error) {
              const reason = error instanceof ApiError ? classifyApiError(error) : null;
              if (reason?.kind === "expired") continue;
              update(index, { step: "failed", error: fail(item.symbol, "execute", error) });
              break;
            }
          }
          if (!done && current[index]!.step !== "failed") {
            update(index, {
              step: "failed",
              error: "The quote expired before it was sent. Please try again.",
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
