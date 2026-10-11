"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadHistory } from "@/components/markets/history-cache";
import { getJson } from "@/hooks/use-markets";
import { heroQuestion, shuffled, type HeroStock, type HeroStocks } from "@/lib/markets/hero";
import type { ExampleQuote } from "@/lib/markets/types";

import { usePrefersReducedMotion } from "./feature-visuals/visual-frame";

/** How long each stock is shown. */
export const ROTATE_MS = 20_000;
/** The next stock's history and quote are loaded this far into the 20 s, 5 s before the switch. */
const PREFETCH_AT_MS = 15_000;
/** After the visitor stops hovering or touching the chart, rotation waits this long. */
const RESUME_MS = 5_000;
const TICK_MS = 100;
const LIST_RETRY_MS = 6_000;
const QUOTE_TTL_MS = 30_000;
export const HERO_WINDOW = "7d" as const;

/** Shown until the ranked list arrives (and if it can't be read at all). */
const FALLBACK: HeroStock = {
  ticker: "NVDA",
  name: "NVIDIA",
  symbol: "NVDAx",
  icon: null,
  question: heroQuestion("NVIDIA", 0),
};

type QuoteState = { quote: ExampleQuote | null; failed: boolean };
const quoteCache = new Map<string, { at: number; value: Promise<ExampleQuote> }>();

/** A real Jupiter quote for 10 USDC of a hero stock; one request per stock per 30 s in this tab. */
function loadQuote(ticker: string): Promise<ExampleQuote> {
  const hit = quoteCache.get(ticker);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.value;
  const value = getJson<ExampleQuote>(
    `/api/markets/example-quote?ticker=${encodeURIComponent(ticker)}`,
  );
  quoteCache.set(ticker, { at: Date.now(), value });
  value.catch(() => {
    if (quoteCache.get(ticker)?.value === value) quoteCache.delete(ticker);
  });
  return value;
}

/** True when the stock's 7-day history loads and has a line to draw. */
const historyReady = (ticker: string) =>
  loadHistory(ticker, HERO_WINDOW).then(
    (points) => points.length >= 2,
    () => false,
  );

/** The first of `tickers` whose history loads, and the ones before it that failed. */
async function firstReady(tickers: readonly string[]) {
  const failed: string[] = [];
  for (const ticker of tickers) {
    if (await historyReady(ticker)) return { ready: ticker, failed };
    failed.push(ticker);
  }
  return { ready: null, failed };
}

/**
 * The hero chart's rotation: the ranked list from /api/markets/hero (shuffled
 * once per page load), the stock on show, and a 20 s clock that moves to the
 * next one. The clock stops while the visitor hovers or touches the chart
 * (resuming 5 s after they stop) and while the tab is hidden; under reduced
 * motion it never runs and the pills switch stocks by hand. The next stock's
 * history and quote load 5 s ahead, so a switch never shows a loading state;
 * a stock whose history fails is skipped (and dropped if it fails twice) and the one after it
 * is used.
 */
export function useHeroRotation() {
  const reduce = usePrefersReducedMotion();
  const [list, setList] = useState<HeroStock[]>([]);
  const [dropped, setDropped] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>(FALLBACK.ticker);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  /** Bumped to restart the 20 s when the stock on show is picked again. */
  const [restarts, setRestarts] = useState(0);
  const [retries, setRetries] = useState(0);

  const bar = useRef<HTMLSpanElement>(null);
  const hovering = useRef(false);
  const resumeAt = useRef(0);
  const failures = useRef<Record<string, number>>({});

  // The ranked list: asked for again while the server is still checking histories.
  useEffect(() => {
    const abort = new AbortController();
    let timer: number | undefined;
    const load = () =>
      getJson<HeroStocks>("/api/markets/hero", abort.signal)
        .then((body) => {
          // New arrivals join in a random order; stocks already listed keep their place.
          setList((have) => [
            ...have,
            ...shuffled(body.stocks.filter((s) => !have.some((h) => h.ticker === s.ticker))),
          ]);
          if (body.pending) timer = window.setTimeout(load, LIST_RETRY_MS);
        })
        .catch((e: unknown) => {
          if (abort.signal.aborted) return;
          console.error("[home] hero stocks failed", e);
          timer = window.setTimeout(load, LIST_RETRY_MS * 5);
        });
    void load();
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const stocks = useMemo(() => list.filter((s) => !dropped.includes(s.ticker)), [list, dropped]);
  const order = stocks.map((s) => s.ticker).join(",");
  // Until a listed stock is ready this stays on the last one shown (NVDA at first).
  const stock = list.find((s) => s.ticker === current) ?? FALLBACK;

  const fetchQuote = useCallback((ticker: string) => {
    loadQuote(ticker).then(
      (quote) => setQuotes((q) => ({ ...q, [ticker]: { quote, failed: false } })),
      (e: unknown) => {
        console.error("[home] hero quote failed", ticker, e);
        setQuotes((q) => ({ ...q, [ticker]: { quote: q[ticker]?.quote ?? null, failed: true } }));
      },
    );
  }, []);

  /** Shows the first of `tickers` whose history loads, dropping the ones that don't. */
  const showFirstReady = useCallback(
    (tickers: readonly string[]) =>
      firstReady(tickers).then(({ ready, failed }) => {
        // One failure can be a busy moment upstream: skip the stock this time, drop it the second time.
        const gone = failed.filter((t) => {
          failures.current[t] = (failures.current[t] ?? 0) + 1;
          return failures.current[t]! >= 2;
        });
        if (gone.length > 0) setDropped((d) => [...new Set([...d, ...gone])]);
        if (!ready) return false;
        setCurrent(ready);
        setRestarts((n) => n + 1);
        return true;
      }),
    [],
  );

  // Once the list arrives (or the stock on show is dropped), move onto a listed stock.
  useEffect(() => {
    if (!order || order.split(",").includes(current)) return;
    let timer: number | undefined;
    void showFirstReady(order.split(",")).then((ok) => {
      // None loaded (a busy moment upstream): try again shortly.
      if (!ok) timer = window.setTimeout(() => setRetries((n) => n + 1), LIST_RETRY_MS);
    });
    return () => window.clearTimeout(timer);
  }, [order, current, retries, showFirstReady]);

  // The quote for the stock on show, refreshed every 30 s while the tab is visible.
  useEffect(() => {
    fetchQuote(current);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchQuote(current);
    }, QUOTE_TTL_MS);
    return () => window.clearInterval(id);
  }, [current, fetchQuote]);

  const auto = !reduce && stocks.length > 1;
  // The clock reads the latest order when it needs it, so a list that is still
  // filling in doesn't restart the 20 s.
  const latestOrder = useRef(order);
  useEffect(() => {
    latestOrder.current = order;
  }, [order]);

  // The 20 s clock. It only counts time while nothing is pausing it.
  useEffect(() => {
    const fill = bar.current;
    if (fill) fill.style.transform = "scaleX(0)";
    if (!auto) return;
    // The stocks after the one on show, in order, wrapping round.
    const after = () => {
      const tickers = latestOrder.current.split(",");
      const at = tickers.indexOf(current);
      return at < 0 ? tickers : [...tickers.slice(at + 1), ...tickers.slice(0, at)];
    };
    let elapsed = 0;
    let last = performance.now();
    let prefetched = false;
    let switching = false;
    const id = window.setInterval(() => {
      const now = performance.now();
      // A throttled background tab can deliver one late tick: never count more than a few ticks' worth.
      const step = Math.min(now - last, TICK_MS * 3);
      last = now;
      if (switching || document.hidden || hovering.current || now < resumeAt.current) return;
      elapsed += step;
      if (fill) fill.style.transform = `scaleX(${Math.min(1, elapsed / ROTATE_MS)})`;
      const next = after()[0];
      if (!prefetched && elapsed >= PREFETCH_AT_MS && next) {
        prefetched = true;
        void historyReady(next);
        fetchQuote(next);
      }
      if (elapsed >= ROTATE_MS) {
        switching = true;
        // Nothing else ready: start this stock's 20 s again.
        void showFirstReady(after()).then(() => {
          switching = false;
          elapsed = 0;
          prefetched = false;
        });
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [auto, current, restarts, fetchQuote, showFirstReady]);

  /** Jump to a stock (a pill): shows it once its history is in, and restarts the 20 s. */
  const jump = useCallback(
    (ticker: string) => {
      fetchQuote(ticker);
      void showFirstReady([ticker]);
    },
    [fetchQuote, showFirstReady],
  );

  /** Spread onto the hero visual: hovering or touching it holds the rotation. */
  const hold = useMemo(() => {
    const touch = () => {
      resumeAt.current = performance.now() + RESUME_MS;
    };
    return {
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") hovering.current = true;
      },
      onPointerLeave: () => {
        hovering.current = false;
        touch();
      },
      onPointerDown: touch,
      onKeyDown: touch,
      onFocus: touch,
    };
  }, []);

  return {
    /** The stocks in rotation (empty until the list arrives). */
    stocks,
    /** The stock on show: from the list, or NVDA until a listed one is ready. */
    stock,
    quote: quotes[current] ?? null,
    auto,
    jump,
    hold,
    bar,
  };
}
