"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { assistantApi } from "@/lib/api-client";
import type { ItemQuote } from "@/lib/assistant/review";

const DEBOUNCE_MS = 600;

type Wanted = { symbol: string; usdcAmount: number };
const keyOf = (item: Wanted) => `${item.symbol}:${item.usdcAmount}`;

/**
 * Fresh Jupiter quotes for a plan's items. Only items whose amount changed are
 * re-quoted (after a short pause in typing); `refresh()` re-quotes them all.
 * The server paces Jupiter calls, so quotes arrive one by one.
 */
export function usePlanQuotes(items: Wanted[], wallet: string | null, enabled: boolean) {
  const [quoted, setQuoted] = useState<Record<string, { key: string; quote: ItemQuote }>>({});
  const [inFlight, setInFlight] = useState(0);
  const [refreshes, setRefreshes] = useState(0);
  const latest = useRef<Record<string, { key: string; quote: ItemQuote }>>({});
  const handled = useRef(0);
  const key = items.map(keyOf).join("|");

  useEffect(() => {
    if (!enabled || !wallet) return;
    const wanted: Wanted[] = key
      ? key.split("|").map((k) => {
          const at = k.lastIndexOf(":");
          return { symbol: k.slice(0, at), usdcAmount: Number(k.slice(at + 1)) };
        })
      : [];
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      const force = handled.current !== refreshes;
      handled.current = refreshes;
      const stale = wanted.filter(
        (item) =>
          item.usdcAmount > 0 && (force || latest.current[item.symbol]?.key !== keyOf(item)),
      );
      if (stale.length === 0) return;
      setInFlight((n) => n + 1);
      try {
        for (const item of stale) {
          let quote: ItemQuote;
          try {
            quote = await assistantApi.quote({ ...item, wallet }, abort.signal);
          } catch (error) {
            if (abort.signal.aborted) return;
            quote = {
              symbol: item.symbol,
              quote: null,
              reason: error instanceof Error ? error.message : "Couldn't get a quote",
              token: null,
            };
          }
          if (abort.signal.aborted) return;
          latest.current = { ...latest.current, [item.symbol]: { key: keyOf(item), quote } };
          setQuoted(latest.current);
        }
      } finally {
        setInFlight((n) => n - 1);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [key, enabled, refreshes, wallet]);

  /** Only quotes for the amounts currently entered. */
  const quotes = useMemo(() => {
    const current = new Map<string, ItemQuote>();
    for (const item of items) {
      const entry = quoted[item.symbol];
      if (entry?.key === keyOf(item)) current.set(item.symbol, entry.quote);
    }
    return current;
  }, [items, quoted]);

  const refresh = useCallback(() => setRefreshes((n) => n + 1), []);
  return { quotes, quoting: inFlight > 0 || quotes.size < items.length, refresh };
}

/** The wallet's USDC and SOL for the pre-flight checks; `reload()` after buying. */
export function useWalletFunds(wallet: string | null) {
  const [funds, setFunds] = useState<{ usdc: number; sol: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    if (!wallet) return;
    const abort = new AbortController();
    assistantApi
      .balances(wallet, abort.signal)
      .then((result) => {
        if (result.usdc === null || result.sol === null) {
          setError(result.reason ?? "Couldn't read your wallet");
        } else {
          setFunds({ usdc: result.usdc, sol: result.sol });
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => abort.abort();
  }, [wallet, loads]);

  const reload = useCallback(() => setLoads((n) => n + 1), []);
  return { funds, error, reload };
}
