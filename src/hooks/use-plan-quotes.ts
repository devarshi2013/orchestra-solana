"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { assistantApi } from "@/lib/api-client";
import type { ItemQuote } from "@/lib/assistant/review";
import { friendlyError, friendlyKind } from "@/lib/friendly-error";

/** Wait this long after typing stops before asking for a quote. */
const DEBOUNCE_MS = 500;

type Wanted = { symbol: string; usdcAmount: number };
/** Each item's latest quote, with the amount it was for. */
type Quoted = Record<string, { key: string; quote: ItemQuote }>;
const keyOf = (item: Wanted) => `${item.symbol}:${item.usdcAmount}`;

/**
 * Fresh Jupiter quotes for a plan's items. Only items whose amount changed are
 * re-quoted (500 ms after typing stops); `refresh()` clears errors and re-quotes
 * them all. Items are quoted one after another. Nothing is retried on its own:
 * a failure (a rate limit too) shows its friendly error until `refresh()`.
 * Failures are logged to the console, never shown raw.
 */
export function usePlanQuotes(items: Wanted[], wallet: string | null, enabled: boolean) {
  const [quoted, setQuoted] = useState<Quoted>({});
  const [inFlight, setInFlight] = useState(0);
  const [refreshes, setRefreshes] = useState(0);
  const latest = useRef<Quoted>({});
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
            console.error(`[quote] ${item.symbol} failed`, error);
            quote = {
              symbol: item.symbol,
              quote: null,
              reason: friendlyError(error),
              errorKind: friendlyKind(error),
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

  /** "Refresh quotes": clears the errors (the items show as loading) and quotes again. */
  const refresh = useCallback(() => {
    latest.current = Object.fromEntries(
      Object.entries(latest.current).filter(([, entry]) => entry.quote.quote !== null),
    );
    setQuoted(latest.current);
    setRefreshes((n) => n + 1);
  }, []);
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
          // The server sends the friendly reason.
          setError(friendlyError(result.reason));
        } else {
          setFunds({ usdc: result.usdc, sol: result.sol });
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (abort.signal.aborted) return;
        console.error("[wallet] balances failed", e);
        setError(friendlyError(e));
      });
    return () => abort.abort();
  }, [wallet, loads]);

  const reload = useCallback(() => setLoads((n) => n + 1), []);
  return { funds, error, reload };
}
