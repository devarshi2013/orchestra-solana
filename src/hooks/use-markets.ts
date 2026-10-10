"use client";

import { useEffect, useState } from "react";

import { friendlyError } from "@/lib/friendly-error";
import type { Point } from "@/lib/market/series";
import type { MarketRow } from "@/lib/markets/types";

/** How often live prices are asked for, while the tab is visible. */
export const PRICE_POLL_MS = 12_000;

export type LivePrice = { price: number; change24h: number | null };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
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

/** Every company in the screener (from /api/markets, cached on the server for 60 s). */
export function useMarketList() {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    getJson<{ rows: MarketRow[] }>("/api/markets", abort.signal)
      .then((body) => {
        setRows(body.rows);
        setError(null);
      })
      .catch((e: unknown) => {
        if (abort.signal.aborted) return;
        console.error("[markets] list failed", e);
        setError(friendlyError(e));
        // Try again shortly (the server caches, so this is cheap).
        setTimeout(() => setAttempt((n) => n + 1), 10_000);
      });
    return () => abort.abort();
  }, [attempt]);

  return { rows, error };
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
 * Live prices for the given tickers (the rows on screen): one batched request
 * every 12 s, only while the tab is visible, and again as soon as it returns.
 */
export function useLivePrices(tickers: readonly string[]) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const visible = usePageVisible();
  const key = [...new Set(tickers)].sort().slice(0, 40).join(",");

  useEffect(() => {
    if (!key || !visible) return;
    const abort = new AbortController();
    const load = () =>
      getJson<{ prices: Record<string, LivePrice> }>(
        `/api/markets/prices?tickers=${encodeURIComponent(key)}`,
        abort.signal,
      )
        .then((body) => setPrices((current) => ({ ...current, ...body.prices })))
        .catch((e: unknown) => {
          if (!abort.signal.aborted) console.error("[markets] prices failed", e);
        });
    void load();
    const id = window.setInterval(load, PRICE_POLL_MS);
    return () => {
      window.clearInterval(id);
      abort.abort();
    };
  }, [key, visible]);

  return prices;
}

/**
 * 24h sparklines for the given tickers, asked for once each; ones still
 * loading on the server are asked for again a few seconds later.
 */
export function useSparklines(tickers: readonly string[], window: "24h" | "7d" | "30d" = "24h") {
  const [series, setSeries] = useState<Record<string, Point[] | null>>({});
  const [retry, setRetry] = useState(0);
  // A few at a time, so the rows at the top of the screen fill in first.
  const missing = tickers.filter((t) => !(t in series)).slice(0, 16);
  const key = missing.sort().join(",");

  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      getJson<{ series: Record<string, Point[] | null>; pending: string[] }>(
        `/api/markets/sparklines?tickers=${encodeURIComponent(key)}&window=${window}`,
        abort.signal,
      )
        .then((body) => {
          setSeries((current) => ({ ...current, ...body.series }));
          if (body.pending.length > 0) setTimeout(() => setRetry((n) => n + 1), 5_000);
        })
        .catch((e: unknown) => {
          if (!abort.signal.aborted) console.error("[markets] sparklines failed", e);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [key, retry, window]);

  return series;
}

export { getJson };
