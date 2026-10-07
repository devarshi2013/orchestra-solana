"use client";

import { useEffect, useState } from "react";

import { ApiError, fetchOrder } from "@/lib/api-client";
import type { OrderResponse } from "@/lib/jupiter/schemas";
import { classifyApiError, classifyOrderError, type SwapError } from "@/lib/swap/errors";

const DEBOUNCE_MS = 500;
/** Quotes go stale fast; refresh while the user is looking at one. */
export const QUOTE_REFRESH_MS = 15_000;

type QuoteParams = {
  inputMint: string;
  outputMint: string;
  /** Base units; null/0 disables quoting. */
  amount: bigint | null;
  /** Connected wallet. Lets Jupiter report balance/fee problems up front. */
  taker?: string;
  /** Stop fetching (e.g. while a swap is in flight). */
  paused?: boolean;
};

type QuoteState = { key: string; quote?: OrderResponse; error?: SwapError };

export function useQuote({ inputMint, outputMint, amount, taker, paused }: QuoteParams) {
  const amountStr = amount && amount > 0n ? amount.toString() : null;
  const key = amountStr ? `${inputMint}|${outputMint}|${amountStr}|${taker ?? ""}` : null;

  const [state, setState] = useState<QuoteState | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!key || !amountStr || paused) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const quote = await fetchOrder(
          { inputMint, outputMint, amount: amountStr, taker },
          controller.signal,
        );
        // transaction "" = priced but not executable; keep the price, surface why.
        setState({
          key,
          quote,
          error: quote.transaction === "" ? classifyOrderError(quote) : undefined,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          key,
          error:
            error instanceof ApiError
              ? classifyApiError(error)
              : classifyApiError({ status: 500, message: String(error) }),
        });
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, inputMint, outputMint, amountStr, taker, paused, refreshTick]);

  useEffect(() => {
    if (!key || paused) return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), QUOTE_REFRESH_MS);
    return () => clearInterval(id);
  }, [key, paused]);

  const current = state && state.key === key ? state : null;
  return {
    quote: current?.quote,
    error: current?.error,
    /** True until the first response for the current inputs arrives. */
    loading: key !== null && current === null,
    refresh: () => setRefreshTick((t) => t + 1),
  };
}
