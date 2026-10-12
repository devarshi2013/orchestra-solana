"use client";

import { useEffect, useState } from "react";

import { friendlyError } from "@/lib/friendly-error";
import type {
  ChartWindow,
  StockHistoryResponse,
  StockResponse,
  StockSearchResponse,
  StocksResponse,
} from "@/lib/stocks/api";

/** How often the stock list is read again while the tab is visible (the server caches it for 60 s). */
const STOCKS_POLL_MS = 60_000;

/** A `.catch` handler that logs `label` with the error, unless the request was cancelled. */
export const logUnlessAborted = (signal: AbortSignal, label: string) => (e: unknown) => {
  if (!signal.aborted) console.error(label, e);
};

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const body = (await response.json().catch(() => null)) as
    (T & { error?: { message: string } }) | null;
  if (!response.ok || !body) {
    throw Object.assign(new Error(body?.error?.message ?? "Request failed"), {
      status: response.status,
    });
  }
  return body;
}

/** True while the tab is visible (polling pauses when it's hidden). */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * The last successful read of a url, and the error of the latest read when it
 * failed. `data` is only ever replaced by a newer response, so a failed
 * refresh shows as `error` next to data whose own `asOf` says how old it is.
 */
export type Polled<T> = {
  data: T | null;
  error: string | null;
  /** HTTP status of the failed read (404: not listed), when there was a response. */
  status: number | null;
  loading: boolean;
};

/** Reads `url` now and every `ms` while the tab is visible (`ms` 0: once); a null url reads nothing. */
function usePolledJson<T>(url: string | null, ms: number, label: string): Polled<T> {
  const visible = usePageVisible();
  const [state, setState] = useState<{ url: string | null } & Polled<T>>({
    url: null,
    data: null,
    error: null,
    status: null,
    loading: false,
  });
  // A new url starts from nothing: the old data belongs to something else.
  const current =
    state.url === url ? state : { url, data: null, error: null, status: null, loading: !!url };

  useEffect(() => {
    if (!url || !visible) return;
    const abort = new AbortController();
    const load = () =>
      getJson<T>(url, abort.signal)
        .then((data) => setState({ url, data, error: null, status: null, loading: false }))
        .catch((e: unknown) => {
          if (abort.signal.aborted) return;
          console.error(label, e);
          const failure = {
            error: friendlyError(e),
            status: (e as { status?: number }).status ?? null,
            loading: false,
          };
          setState((s) => (s.url === url ? { ...s, ...failure } : { url, data: null, ...failure }));
        });
    void load();
    const timer = ms > 0 ? window.setInterval(load, ms) : undefined;
    return () => {
      abort.abort();
      window.clearInterval(timer);
    };
  }, [url, ms, visible, label]);

  const { data, error, status, loading } = current;
  return { data, error, status, loading };
}

/** Every listed company (GET /api/stocks), read again every minute while visible. */
export const useStocks = () =>
  usePolledJson<StocksResponse>("/api/stocks", STOCKS_POLL_MS, "[stocks] list failed");

/** One company by ticker or token symbol (GET /api/stocks/[ticker]), read again every minute. */
export const useStock = (ticker: string) =>
  usePolledJson<StockResponse>(
    `/api/stocks/${encodeURIComponent(ticker)}`,
    STOCKS_POLL_MS,
    "[stocks] stock failed",
  );

/** Candles of a token's most liquid pool for one timeframe (read once per mint and window). */
export const useStockHistory = (mint: string | null, window: ChartWindow) =>
  usePolledJson<StockHistoryResponse>(
    mint ? `/api/stocks/history?${new URLSearchParams({ mint, window })}` : null,
    0,
    "[stocks] history failed",
  );

/** Jupiter's token search for `query`, 250 ms after typing stops (nothing for an empty query). */
export function useStockSearch(query: string): Polled<StockSearchResponse> {
  const trimmed = query.trim();
  const [settled, setSettled] = useState(trimmed);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(trimmed), 250);
    return () => window.clearTimeout(timer);
  }, [trimmed]);
  const result = usePolledJson<StockSearchResponse>(
    settled ? `/api/stocks/search?${new URLSearchParams({ q: settled })}` : null,
    0,
    "[stocks] search failed",
  );
  // Still typing: the results shown are for an older query.
  return settled === trimmed ? result : { ...result, loading: Boolean(trimmed) };
}
