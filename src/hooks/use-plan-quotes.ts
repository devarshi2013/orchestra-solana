"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { assistantApi } from "@/lib/api-client";
import type { ItemQuote } from "@/lib/assistant/review";
import {
  friendlyError,
  friendlyKind,
  MAX_RATE_LIMIT_RETRIES,
  retryDelayMs,
} from "@/lib/friendly-error";

/** Wait this long after typing stops before asking for a quote. */
const DEBOUNCE_MS = 500;
/** After rate-limit retries run out, try again on our own this often (a few times). */
const AUTO_RETRY_MS = 15_000;
const MAX_AUTO_RETRIES = 3;

type Wanted = { symbol: string; usdcAmount: number };
const keyOf = (item: Wanted) => `${item.symbol}:${item.usdcAmount}`;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  });

/**
 * Fresh Jupiter quotes for a plan's items. Only items whose amount changed are
 * re-quoted (500 ms after typing stops); `refresh()` clears errors and re-quotes
 * them all. Items are quoted one after another. A rate limit is retried up to 3
 * times (1 s, 2 s, 4 s) while the item shows "Retrying…"; only then is the
 * friendly error shown. Failures are logged to the console, never shown raw.
 */
export function usePlanQuotes(items: Wanted[], wallet: string | null, enabled: boolean) {
  const [quoted, setQuoted] = useState<Record<string, { key: string; quote: ItemQuote }>>({});
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set());
  const [inFlight, setInFlight] = useState(0);
  const [refreshes, setRefreshes] = useState(0);
  const latest = useRef<Record<string, { key: string; quote: ItemQuote }>>({});
  const handled = useRef(0);
  const autoRetries = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const markRetrying = (symbol: string, on: boolean) =>
      setRetrying((current) => {
        const next = new Set(current);
        if (on) next.add(symbol);
        else next.delete(symbol);
        return next;
      });

    const timer = setTimeout(async () => {
      const force = handled.current !== refreshes;
      handled.current = refreshes;
      const stale = wanted.filter(
        (item) =>
          item.usdcAmount > 0 && (force || latest.current[item.symbol]?.key !== keyOf(item)),
      );
      if (stale.length === 0) return;
      setInFlight((n) => n + 1);
      let rateLimited = false;
      try {
        for (const item of stale) {
          let quote: ItemQuote | null = null;
          for (let attempt = 0; ; attempt++) {
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
            if (quote.errorKind !== "rate_limited" || attempt >= MAX_RATE_LIMIT_RETRIES) break;
            markRetrying(item.symbol, true);
            await wait(retryDelayMs(attempt + 1), abort.signal);
            if (abort.signal.aborted) return;
          }
          markRetrying(item.symbol, false);
          if (abort.signal.aborted) return;
          if (quote.errorKind === "rate_limited") rateLimited = true;
          latest.current = { ...latest.current, [item.symbol]: { key: keyOf(item), quote } };
          setQuoted(latest.current);
        }
      } finally {
        setInFlight((n) => n - 1);
      }
      // Still rate-limited after the retries: try again by ourselves a few times.
      if (rateLimited && autoRetries.current < MAX_AUTO_RETRIES) {
        autoRetries.current += 1;
        autoTimer.current = setTimeout(() => setRefreshes((n) => n + 1), AUTO_RETRY_MS);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
      setRetrying(new Set());
    };
  }, [key, enabled, refreshes, wallet]);

  useEffect(
    () => () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    },
    [],
  );

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
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoRetries.current = 0;
    latest.current = Object.fromEntries(
      Object.entries(latest.current).filter(([, entry]) => entry.quote.quote !== null),
    );
    setQuoted(latest.current);
    setRefreshes((n) => n + 1);
  }, []);
  return { quotes, quoting: inFlight > 0 || quotes.size < items.length, retrying, refresh };
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
          // The server sends a friendly reason; anything else gets the generic line.
          setError(friendlyError(result.reason ?? "network error"));
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
