"use client";

import { useEffect, useState } from "react";

import { getJson } from "@/hooks/use-markets";
import type { ExampleQuote, ResearchTop } from "@/lib/markets/types";

import { useHomeMarket, useWatch } from "../live/home-market";

const REFRESH_MS = 30_000;

export type StoryItem = {
  ticker: string;
  name: string;
  icon: string | null;
  marketCap: number;
  return1y: number | null;
  /** undefined: still loading; null: Jupiter couldn't quote it. */
  quote: ExampleQuote | null | undefined;
  /** Live price from the page's shared poll (null until known). */
  price: number | null;
};

export type StoryData = {
  /** null while loading. */
  items: StoryItem[] | null;
  failed: boolean;
  basis: ResearchTop["basis"] | null;
  /** When the research data was read (ms). */
  asOf: number | null;
};

/**
 * The real data behind the walkthrough: the three largest tech stocks
 * (/api/markets/research-top), a real Jupiter /order quote for 10 USDC of each
 * (no taker; refreshed every 30 s while `active` and the tab is visible), and
 * their live prices from the page's shared poll.
 */
export function useStoryData(active: boolean): StoryData {
  const { stocks } = useHomeMarket();
  const [research, setResearch] = useState<ResearchTop | null>(null);
  const [failed, setFailed] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, ExampleQuote | null>>({});
  const [round, setRound] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    getJson<ResearchTop>("/api/markets/research-top", abort.signal)
      .then(setResearch)
      .catch((e: unknown) => {
        if (abort.signal.aborted) return;
        console.error("[story] research failed", e);
        setFailed(true);
      });
    return () => abort.abort();
  }, []);

  const tickers = (research?.rows ?? []).map((r) => r.ticker);
  const key = tickers.join(",");
  useWatch("story", tickers);

  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    for (const ticker of key.split(",")) {
      getJson<ExampleQuote>(`/api/markets/example-quote?ticker=${ticker}`, abort.signal)
        .then((q) => setQuotes((current) => ({ ...current, [ticker]: q })))
        .catch((e: unknown) => {
          if (abort.signal.aborted) return;
          console.error(`[story] quote ${ticker} failed`, e);
          setQuotes((current) => (ticker in current ? current : { ...current, [ticker]: null }));
        });
    }
    return () => abort.abort();
  }, [key, round]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setRound((n) => n + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [active]);

  return {
    items: research
      ? research.rows.map((r) => ({
          ticker: r.ticker,
          name: r.name,
          icon: r.icon,
          marketCap: r.marketCap,
          return1y: r.return1y,
          quote: quotes[r.ticker],
          price: stocks.find((s) => s.ticker === r.ticker)?.price ?? null,
        }))
      : null,
    failed: failed && !research,
    basis: research?.basis ?? null,
    asOf: research ? Date.parse(research.asOf) : null,
  };
}
