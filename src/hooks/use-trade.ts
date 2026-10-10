"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, executeSwap, fetchOrder } from "@/lib/api-client";
import {
  friendlyError,
  friendlyKind,
  MAX_RATE_LIMIT_RETRIES,
  retryDelayMs,
} from "@/lib/friendly-error";
import type { OrderResponse } from "@/lib/jupiter/schemas";
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

export type TradeSide = "buy" | "sell";
export type TradeStep = "idle" | "signing" | "sending" | "done" | "failed";

/** Logs the details (console only) and returns one friendly line. */
const explain = (stage: string, error: unknown, classified?: unknown) => {
  console.error(`[trade] ${stage} failed`, error);
  return friendlyError(classified ?? (error instanceof ApiError ? classifyApiError(error) : error));
};

/** fetchOrder, retrying a rate limit up to 3 times (1 s, 2 s, 4 s); `onRetry` runs before each wait. */
async function orderWithRetry(
  query: Parameters<typeof fetchOrder>[0],
  signal: AbortSignal | undefined,
  onRetry: () => void,
): Promise<OrderResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOrder(query, signal);
    } catch (error) {
      if (friendlyKind(error) !== "rate_limited" || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;
      onRetry();
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt + 1)));
      if (signal?.aborted) throw error;
    }
  }
}

/**
 * One trade between USDC and a registry stock token, through Jupiter Swap v2:
 * a quote 500 ms after the amount stops changing, then, on approval, a fresh
 * order for this wallet → the wallet signs (never sends) → our
 * /api/swap/execute lands it. Nothing is signed automatically. `mint` comes
 * from the registry (the server rejects anything else).
 */
export function useTrade({
  side,
  mint,
  decimals,
  amount,
}: {
  side: TradeSide;
  mint: string;
  decimals: number;
  /** USDC to spend (buy) or tokens to sell; 0 for none. */
  amount: number;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [quote, setQuote] = useState<{
    key: string;
    order: OrderResponse | null;
    error: string | null;
  } | null>(null);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [step, setStep] = useState<TradeStep>("idle");
  const [result, setResult] = useState<{ signature: string | null; error: string | null }>({
    signature: null,
    error: null,
  });
  const busy = useRef(false);

  const inputMint = side === "buy" ? USDC_MINT : mint;
  const outputMint = side === "buy" ? mint : USDC_MINT;
  const inDecimals = side === "buy" ? USDC_DECIMALS : decimals;
  const key = `${side}:${mint}:${amount}`;

  useEffect(() => {
    if (!(amount > 0)) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      orderWithRetry(
        {
          inputMint,
          outputMint,
          amount: toBaseUnits(amount, inDecimals).toString(),
        },
        abort.signal,
        () => setRetryingKey(key),
      )
        .then((order) => setQuote({ key, order, error: null }))
        .catch((e: unknown) => {
          if (!abort.signal.aborted) setQuote({ key, order: null, error: explain("quote", e) });
        })
        .finally(() => setRetryingKey((k) => (k === key ? null : k)));
    }, 500);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [key, amount, inputMint, outputMint, inDecimals]);

  const current = amount > 0 && quote?.key === key ? quote : null;

  /** Builds a fresh order for this wallet, asks the wallet to sign it, and lands it. */
  const execute = useCallback(async () => {
    if (busy.current || !publicKey || !signTransaction || !(amount > 0)) return;
    busy.current = true;
    setResult({ signature: null, error: null });
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        setStep("signing");
        let order: OrderResponse;
        try {
          order = await orderWithRetry(
            {
              inputMint,
              outputMint,
              amount: toBaseUnits(amount, inDecimals).toString(),
              taker: publicKey.toBase58(),
            },
            undefined,
            () => {},
          );
        } catch (e) {
          setResult({ signature: null, error: explain("order", e) });
          setStep("failed");
          return;
        }
        if (!order.transaction) {
          setResult({ signature: null, error: explain("build", order, classifyOrderError(order)) });
          setStep("failed");
          return;
        }
        let signed: VersionedTransaction;
        try {
          signed = await signTransaction(
            VersionedTransaction.deserialize(base64ToBytes(order.transaction)),
          );
        } catch (e) {
          setResult({ signature: null, error: explain("sign", e, classifyWalletError(e)) });
          setStep("failed");
          return;
        }
        // The wallet prompt may have outlived the quote: get a fresh one.
        const blockHeight = await connection.getBlockHeight("confirmed").catch(() => undefined);
        if (isOrderExpired(order, { now: Date.now(), blockHeight })) continue;

        setStep("sending");
        try {
          const landed = await executeSwap({
            signedTransaction: bytesToBase64(signed.serialize()),
            requestId: order.requestId,
          });
          if (landed.status === "Success") {
            setResult({ signature: landed.signature ?? null, error: null });
            setStep("done");
            return;
          }
          const reason = classifyExecuteResult(landed);
          if (reason.kind === "expired") continue;
          setResult({
            signature: landed.signature ?? null,
            error: explain("execute", landed, reason),
          });
          setStep("failed");
          return;
        } catch (e) {
          if (e instanceof ApiError && classifyApiError(e).kind === "expired") continue;
          setResult({ signature: null, error: explain("execute", e) });
          setStep("failed");
          return;
        }
      }
      setResult({
        signature: null,
        error: "The quote expired before it was sent. Please try again.",
      });
      setStep("failed");
    } finally {
      busy.current = false;
    }
  }, [amount, connection, inDecimals, inputMint, outputMint, publicKey, signTransaction]);

  const reset = useCallback(() => {
    setStep("idle");
    setResult({ signature: null, error: null });
  }, []);

  return {
    quote: current?.order ?? null,
    quoteError: current?.error ?? null,
    quoting: amount > 0 && !current,
    retrying: retryingKey === key,
    step,
    signature: result.signature,
    error: result.error,
    execute,
    reset,
    connected: Boolean(publicKey),
    canSign: Boolean(signTransaction),
  };
}
