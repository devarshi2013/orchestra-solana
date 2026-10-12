"use client";

import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useRef, useState } from "react";

import { useConnection, useWallet } from "@/components/wallet";
import { showPnlToast } from "@/components/share/pnl-toast";
import { ApiError, executeSwap, fetchOrder, recordFill } from "@/lib/api-client";
import { friendlyError } from "@/lib/friendly-error";
import type { OrderResponse } from "@/lib/jupiter/schemas";
import { base64ToBytes, bytesToBase64 } from "@/lib/solana";
import {
  classifyApiError,
  classifyExecuteResult,
  classifyOrderError,
  classifyWalletError,
} from "@/lib/swap/errors";
import type { Fill } from "@/lib/strategies/types";
import { isOrderExpired } from "@/lib/swap/quote";
import { USDC_MINT } from "@/lib/tokens";
import { toBaseUnits, USDC_DECIMALS } from "@/lib/units";

export type TradeSide = "buy" | "sell";
export type TradeStep = "idle" | "signing" | "sending" | "done" | "failed";

const IDLE = { signature: null, error: null };

/** Logs the details (console only) and returns one friendly line. */
const explain = (stage: string, error: unknown, classified?: unknown) => {
  console.error(`[trade] ${stage} failed`, error);
  return friendlyError(classified ?? (error instanceof ApiError ? classifyApiError(error) : error));
};

/**
 * One trade between USDC and a listed stock token, through Jupiter Swap v2:
 * a quote 500 ms after the amount stops changing, then, on approval, a fresh
 * order for this wallet → the wallet signs (never sends) → our
 * /api/swap/execute lands it. Nothing is signed automatically, and nothing is
 * retried: a failure (a rate limit too) is shown as is. The server only
 * accepts listed stock mints. A landed swap is recorded for the profile
 * (checked on-chain by the server; nothing is recorded while signed out).
 */
export function useTrade({
  side,
  mint,
  decimals,
  amount,
  strategyId,
  onRecorded,
}: {
  side: TradeSide;
  mint: string;
  decimals: number;
  /** USDC to spend (buy) or tokens to sell; 0 for none. */
  amount: number;
  /** The strategy this buy fills, if any. */
  strategyId?: string;
  /** Called once the landed swap is recorded (null when it couldn't be). */
  onRecorded?: (fill: Fill | null) => void;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [quote, setQuote] = useState<{
    key: string;
    order: OrderResponse | null;
    error: string | null;
  } | null>(null);
  const [step, setStep] = useState<TradeStep>("idle");
  const [result, setResult] = useState<{ signature: string | null; error: string | null }>(IDLE);
  const busy = useRef(false);

  const [inputMint, outputMint, inDecimals] =
    side === "buy" ? [USDC_MINT, mint, USDC_DECIMALS] : [mint, USDC_MINT, decimals];
  const key = `${side}:${mint}:${amount}`;

  useEffect(() => {
    if (!(amount > 0)) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetchOrder(
        { inputMint, outputMint, amount: toBaseUnits(amount, inDecimals).toString() },
        abort.signal,
      )
        .then((order) => setQuote({ key, order, error: null }))
        .catch((e: unknown) => {
          if (!abort.signal.aborted) setQuote({ key, order: null, error: explain("quote", e) });
        });
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
    setResult(IDLE);
    const fail = (error: string, signature: string | null = null) => {
      setResult({ signature, error });
      setStep("failed");
    };
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        setStep("signing");
        let order: OrderResponse;
        try {
          order = await fetchOrder({
            inputMint,
            outputMint,
            amount: toBaseUnits(amount, inDecimals).toString(),
            taker: publicKey.toBase58(),
          });
        } catch (e) {
          return fail(explain("order", e));
        }
        if (!order.transaction) return fail(explain("build", order, classifyOrderError(order)));
        let signed: VersionedTransaction;
        try {
          signed = await signTransaction(
            VersionedTransaction.deserialize(base64ToBytes(order.transaction)),
          );
        } catch (e) {
          return fail(explain("sign", e, classifyWalletError(e)));
        }
        // The wallet prompt may have outlived the quote: get a fresh one.
        let blockHeight: number;
        try {
          blockHeight = await connection.getBlockHeight("confirmed");
        } catch (e) {
          return fail(explain("block height", e));
        }
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
            if (landed.signature)
              void recordFill(landed.signature, strategyId).then((fill) => {
                if (fill) showPnlToast(fill);
                onRecorded?.(fill);
              });
            return;
          }
          const reason = classifyExecuteResult(landed);
          if (reason.kind === "expired") continue;
          return fail(explain("execute", landed, reason), landed.signature ?? null);
        } catch (e) {
          if (e instanceof ApiError && classifyApiError(e).kind === "expired") continue;
          return fail(explain("execute", e));
        }
      }
      fail("The quote expired before it was sent. Please try again.");
    } finally {
      busy.current = false;
    }
  }, [
    amount,
    inDecimals,
    connection,
    inputMint,
    outputMint,
    publicKey,
    signTransaction,
    strategyId,
    onRecorded,
  ]);

  const reset = useCallback(() => {
    setStep("idle");
    setResult(IDLE);
  }, []);

  return {
    quote: current?.order ?? null,
    quoteError: current?.error ?? null,
    quoting: amount > 0 && !current,
    step,
    signature: result.signature,
    error: result.error,
    execute,
    reset,
    connected: Boolean(publicKey),
    canSign: Boolean(signTransaction),
  };
}
