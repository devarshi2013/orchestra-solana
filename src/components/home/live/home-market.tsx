"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getJson, PRICE_POLL_MS, type LivePrice } from "@/hooks/use-markets";
import { homeRows, tapeRows, type HomeSort, type HomeTab } from "@/lib/markets/home";
import type { MarketOverview, MarketRow } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

/** How often the overview (rows, totals) is read again; the server caches it for 60 s. */
const OVERVIEW_MS = 60_000;

type HomeMarket = {
  /** null while loading (or when it failed: see `failed`). */
  overview: MarketOverview | null;
  failed: boolean;
  /** Stock and crypto rows with the latest polled prices merged in. */
  stocks: MarketRow[];
  crypto: MarketRow[];
  /** When the data on screen was last read (ms), or null before the first read. */
  asOf: number | null;
  tab: HomeTab;
  setTab: (tab: HomeTab) => void;
  sector: string | null;
  setSector: (sector: string | null) => void;
  sort: HomeSort;
  setSort: (sort: HomeSort) => void;
  /** The rows the markets table is showing. */
  tableRows: MarketRow[];
  /** Adds tickers to the page's one price poll under an id (an empty list removes them). */
  setWatch: (id: string, tickers: readonly string[]) => void;
  /** The asset whose details drawer is open, if any. */
  selected: MarketRow | null;
  openAsset: (ticker: string) => void;
  closeAsset: () => void;
};

const Context = createContext<HomeMarket | null>(null);

export function useHomeMarket(): HomeMarket {
  const value = useContext(Context);
  if (!value) throw new Error("useHomeMarket must be used inside <HomeMarketProvider>");
  return value;
}

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * The home page's live data, shared by every live section: the overview
 * (rows, totals) read once a minute, and ONE batched price request every 12 s
 * for everything on screen (the ticker tape and the table's rows). Both pause
 * while the tab is hidden and resume as soon as it's visible again.
 */
export function HomeMarketProvider({ children }: { children: ReactNode }) {
  const visible = usePageVisible();
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [asOf, setAsOf] = useState<number | null>(null);
  const [tab, setTab] = useState<HomeTab>("stocks");
  const [sector, setSector] = useState<string | null>(null);
  const [sort, setSort] = useState<HomeSort>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const setWatch = useCallback((id: string, tickers: readonly string[]) => {
    const key = [...tickers].sort().join(",");
    setExtra((current) => (current[id] === key ? current : { ...current, [id]: key }));
  }, []);
  const openAsset = useCallback((ticker: string) => setSelectedTicker(ticker), []);
  const closeAsset = useCallback(() => setSelectedTicker(null), []);

  useEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    const load = () =>
      getJson<MarketOverview>("/api/markets/overview", abort.signal)
        .then((data) => {
          setOverview(data);
          setFailed(false);
          setAsOf((current) => Math.max(current ?? 0, Date.parse(data.asOf)));
        })
        .catch((e: unknown) => {
          if (abort.signal.aborted) return;
          console.error("[home] overview failed", e);
          setFailed(true);
        });
    void load();
    const id = window.setInterval(load, OVERVIEW_MS);
    return () => {
      window.clearInterval(id);
      abort.abort();
    };
  }, [visible]);

  const merge = useMemo(
    () => (rows: MarketRow[]) =>
      rows.map((r) => {
        const p = prices[r.ticker];
        return p ? { ...r, price: p.price, change24h: p.change24h ?? r.change24h } : r;
      }),
    [prices],
  );
  const stocks = useMemo(() => merge(overview?.rows ?? []), [merge, overview]);
  const crypto = useMemo(() => merge(overview?.crypto ?? []), [merge, overview]);

  // Which rows the table shows is decided from the overview (not the live
  // prices), so the list doesn't reshuffle every 12 s; their prices are live.
  const tableTickers = useMemo(
    () =>
      homeRows(overview?.rows ?? [], overview?.crypto ?? [], tab, sector, sort).map(
        (r) => r.ticker,
      ),
    [overview, tab, sector, sort],
  );
  const tableRows = useMemo(() => {
    const byTicker = new Map([...stocks, ...crypto].map((r) => [r.ticker, r]));
    return tableTickers.flatMap((t) => byTicker.get(t) ?? []);
  }, [tableTickers, stocks, crypto]);

  // One batched request for everything on the page: the tape, the table, and
  // whatever the feature cards registered (setWatch).
  const watch = useMemo(() => {
    const tape = tapeRows(overview?.rows ?? [], overview?.crypto ?? []).map((r) => r.ticker);
    const cards = Object.values(extra).flatMap((key) => (key ? key.split(",") : []));
    return [...new Set([...tape, ...tableTickers, ...cards])].sort().slice(0, 40).join(",");
  }, [overview, tableTickers, extra]);

  useEffect(() => {
    if (!watch || !visible) return;
    const abort = new AbortController();
    const load = () =>
      getJson<{ prices: Record<string, LivePrice> }>(
        `/api/markets/prices?tickers=${encodeURIComponent(watch)}`,
        abort.signal,
      )
        .then((body) => {
          setPrices((current) => ({ ...current, ...body.prices }));
          setAsOf(Date.now());
        })
        .catch((e: unknown) => {
          if (!abort.signal.aborted) console.error("[home] prices failed", e);
        });
    void load();
    const id = window.setInterval(load, PRICE_POLL_MS);
    return () => {
      window.clearInterval(id);
      abort.abort();
    };
  }, [watch, visible]);

  const selected = useMemo(
    () => [...stocks, ...crypto].find((r) => r.ticker === selectedTicker) ?? null,
    [stocks, crypto, selectedTicker],
  );

  const value = useMemo(
    () => ({
      overview,
      failed: failed && !overview,
      stocks,
      crypto,
      asOf,
      tab,
      setTab,
      sector,
      setSector,
      sort,
      setSort,
      tableRows,
      setWatch,
      selected,
      openAsset,
      closeAsset,
    }),
    [
      overview,
      failed,
      stocks,
      crypto,
      asOf,
      tab,
      sector,
      sort,
      tableRows,
      setWatch,
      selected,
      openAsset,
      closeAsset,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Registers tickers with the page's shared price poll while the component is mounted. */
export function useWatch(id: string, tickers: readonly string[]) {
  const { setWatch } = useHomeMarket();
  const key = tickers.join(",");
  useEffect(() => {
    setWatch(id, key ? key.split(",") : []);
    return () => setWatch(id, []);
  }, [id, key, setWatch]);
}

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

/** "● Live · as of 14:32" beside live numbers, or "Data unavailable" when the data couldn't be read. */
export function LiveStamp({
  at,
  failed,
  className,
}: {
  at?: number | null;
  failed?: boolean;
  className?: string;
}) {
  const market = useContext(Context);
  const when = at === undefined ? (market?.asOf ?? null) : at;
  const down = failed ?? market?.failed ?? false;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          down ? "bg-danger" : when ? "bg-gain" : "bg-muted-foreground",
        )}
      />
      {down ? "Data unavailable" : when ? `Live · as of ${time(when)}` : "Loading…"}
    </span>
  );
}
