"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { MARKET_TOKENS, PRICE_POLL_MS, type WindowId } from "@/lib/market/config";
import { appendTick, type Candle, type Tick } from "@/lib/market/series";

/**
 * The home dashboard's market data, shared by the hero chart and every card:
 * - live prices: ONE request (/api/market/prices) every few seconds for all
 *   tokens, paused while the tab is hidden; each answer is appended as a tick;
 * - token stats (logo, market cap, volume, liquidity, holders), loaded once;
 * - price history per window, loaded in batches and kept for the visit.
 * Nothing is invented: a missing number stays missing and the UI says so.
 */

export type LivePrice = { price: number; change24h: number | null };
export type TokenStats = {
  mint: string;
  symbol: string;
  name: string;
  icon: string | null;
  marketCap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  holders: number | null;
};
export type PriceStatus = "loading" | "live" | "paused" | "error";
export type HistoryEntry =
  | { state: "loading" }
  | { state: "ready"; candles: Candle[] }
  | { state: "failed"; reason: string };

type MarketState = {
  prices: Record<string, LivePrice>;
  ticks: Record<string, Tick[]>;
  status: PriceStatus;
  stats: Record<string, TokenStats> | null;
  statsError: boolean;
  history: (window: WindowId, mint: string) => HistoryEntry;
  requestHistory: (window: WindowId, mints: readonly string[]) => void;
};

const MarketContext = createContext<MarketState | null>(null);

const MAX_HISTORY_RETRIES = 6;
const HISTORY_RETRY_MS = 4_000;

export function MarketProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [ticks, setTicks] = useState<Record<string, Tick[]>>({});
  const [status, setStatus] = useState<PriceStatus>("loading");
  const [stats, setStats] = useState<Record<string, TokenStats> | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [historyMap, setHistoryMap] = useState<Record<string, HistoryEntry>>({});
  const requested = useRef(new Set<string>());

  // Live prices: one shared poller, paused while the tab is hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let stopped = false;

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      controller = new AbortController();
      try {
        const response = await fetch("/api/market/prices", { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { at: number; prices: Record<string, LivePrice> };
        const time = Math.floor(body.at / 1000);
        setPrices(body.prices);
        setTicks((all) => {
          const next = { ...all };
          for (const [mint, p] of Object.entries(body.prices)) {
            next[mint] = appendTick(all[mint] ?? [], { time, value: p.price });
          }
          return next;
        });
        setStatus("live");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setStatus("error");
      } finally {
        if (!stopped && document.visibilityState === "visible") {
          timer = setTimeout(poll, PRICE_POLL_MS);
        }
      }
    };

    const onVisibility = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (document.visibilityState === "hidden") {
        controller?.abort();
        setStatus((s) => (s === "loading" ? s : "paused"));
      } else {
        void poll();
      }
    };

    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Token stats, once per visit.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/market/tokens", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        setStats(((await response.json()) as { tokens: Record<string, TokenStats> }).tokens);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setStatsError(true);
      });
    return () => controller.abort();
  }, []);

  const requestHistory = useCallback((window: WindowId, mints: readonly string[]) => {
    const wanted = mints.filter((m) => !requested.current.has(`${window}:${m}`));
    if (wanted.length === 0) return;
    for (const m of wanted) requested.current.add(`${window}:${m}`);
    setHistoryMap((all) => ({
      ...all,
      ...Object.fromEntries(wanted.map((m) => [`${window}:${m}`, { state: "loading" } as const])),
    }));

    const load = async (batch: string[], attempt: number) => {
      try {
        const response = await fetch(
          `/api/market/history?window=${window}&mints=${batch.join(",")}`,
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as {
          series: Record<string, Candle[]>;
          pending: string[];
          failed: Record<string, string>;
        };
        setHistoryMap((all) => {
          const next = { ...all };
          for (const [m, candles] of Object.entries(body.series)) {
            next[`${window}:${m}`] = { state: "ready", candles };
          }
          for (const [m, reason] of Object.entries(body.failed)) {
            next[`${window}:${m}`] = { state: "failed", reason };
          }
          if (attempt >= MAX_HISTORY_RETRIES) {
            for (const m of body.pending) {
              next[`${window}:${m}`] = { state: "failed", reason: "History is taking too long" };
            }
          }
          return next;
        });
        if (body.pending.length > 0 && attempt < MAX_HISTORY_RETRIES) {
          setTimeout(() => void load(body.pending, attempt + 1), HISTORY_RETRY_MS);
        }
      } catch {
        if (attempt < MAX_HISTORY_RETRIES) {
          setTimeout(() => void load(batch, attempt + 1), HISTORY_RETRY_MS);
        } else {
          setHistoryMap((all) => ({
            ...all,
            ...Object.fromEntries(
              batch.map((m) => [
                `${window}:${m}`,
                { state: "failed", reason: "History unavailable" } as const,
              ]),
            ),
          }));
        }
      }
    };
    void load(wanted, 1);
  }, []);

  const history = useCallback(
    (window: WindowId, mint: string): HistoryEntry =>
      historyMap[`${window}:${mint}`] ?? { state: "loading" },
    [historyMap],
  );

  const value = useMemo(
    () => ({ prices, ticks, status, stats, statsError, history, requestHistory }),
    [prices, ticks, status, stats, statsError, history, requestHistory],
  );
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketState {
  const context = useContext(MarketContext);
  if (!context) throw new Error("useMarket must be used inside <MarketProvider>");
  return context;
}

export const ALL_MINTS = MARKET_TOKENS.map((t) => t.mint);
