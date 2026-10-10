"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TokenLogo } from "@/components/market/token-logo";
import { ChangeText } from "@/components/markets/live-number";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/market/series";
import { searchStocks, sectorCounts } from "@/lib/markets/home";
import { cn } from "@/lib/utils";

import { LiveStamp, useHomeMarket, useWatch } from "../live/home-market";
import { useTyping, VisualFrame } from "./visual-frame";

const QUERIES = ["nvidia", "healthcare", "energy ETF"];
const CYCLE_MS = 4000;
const RESULTS = 4;

/**
 * Search card: a search box that types a few example queries in turn and
 * shows REAL matches from the registry (logo, name, ticker, live price, 24h
 * %), with sector pills and their real counts underneath. Click in and type
 * to search for real; choosing a result opens its details drawer.
 */
export function SearchVisual() {
  return (
    <VisualFrame label="Search the stock registry">
      {(state) => <SearchDemo {...state} />}
    </VisualFrame>
  );
}

function SearchDemo({ active, reduce }: { active: boolean; reduce: boolean }) {
  const { overview, failed, stocks, openAsset } = useHomeMarket();
  const [index, setIndex] = useState(0);
  // null: the demo is typing; a string: the visitor has taken over the box.
  const [typedByUser, setTypedByUser] = useState<string | null>(null);
  const [debounced, setDebounced] = useState("");
  const demoQuery = QUERIES[index % QUERIES.length]!;
  const demo = useTyping(demoQuery, active && typedByUser === null, reduce, 70);

  // The demo moves to the next query every 4 s while on screen (not under reduced motion).
  useEffect(() => {
    if (!active || reduce || typedByUser !== null) return;
    const id = window.setTimeout(() => setIndex((i) => i + 1), CYCLE_MS);
    return () => window.clearTimeout(id);
  }, [active, reduce, typedByUser, index]);

  // The visitor's own typing searches after a short pause.
  useEffect(() => {
    if (typedByUser === null) return;
    const id = window.setTimeout(() => setDebounced(typedByUser), 200);
    return () => window.clearTimeout(id);
  }, [typedByUser]);

  // The demo searches as it types (real results for whatever is in the box so far).
  const query = typedByUser === null ? (demo.value.length >= 2 ? demo.value : "") : debounced;
  const results = useMemo(() => searchStocks(stocks, query, RESULTS), [stocks, query]);
  useWatch(
    "search",
    results.map((r) => r.ticker),
  );
  const sectors = useMemo(() => sectorCounts(stocks).slice(0, 4), [stocks]);

  return (
    <>
      <label className="relative block">
        <span className="sr-only">Search stocks</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={typedByUser ?? demo.value}
          onFocus={() => setTypedByUser((current) => current ?? "")}
          onChange={(e) => setTypedByUser(e.target.value)}
          onBlur={() => {
            // An empty box hands control back to the demo.
            if (!typedByUser) {
              setTypedByUser(null);
              setDebounced("");
            }
          }}
          placeholder="Search stocks…"
          className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-[var(--label-blue)]"
        />
      </label>

      <ul className="mt-1.5 flex flex-1 flex-col gap-1 overflow-hidden" aria-live="polite">
        {failed ? (
          <li className="py-4 text-center text-sm text-muted-foreground">Data unavailable</li>
        ) : !overview ? (
          [0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-8 w-full rounded-lg" />
            </li>
          ))
        ) : results.length === 0 ? (
          <li className="py-4 text-center text-xs text-muted-foreground">
            {query ? `No stocks match “${query}”.` : "Type to search every listed stock."}
          </li>
        ) : (
          results.map((r, i) => (
            <li key={r.ticker} className={cn(i === 3 && "max-md:hidden")}>
              <button
                type="button"
                onClick={() => openAsset(r.ticker)}
                className="flex w-full items-center gap-2 rounded-lg border bg-background/60 px-2 py-1 text-left transition-colors duration-200 outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TokenLogo src={r.icon} symbol={r.ticker} className="size-5" />
                <span className="min-w-0 flex-1 truncate text-xs">{r.name}</span>
                <span className="font-mono text-[0.625rem] text-muted-foreground">{r.ticker}</span>
                <span className="w-16 text-right font-mono text-xs tabular-nums">
                  {r.price === null ? "—" : formatPrice(r.price)}
                </span>
                <ChangeText value={r.change24h} className="w-14 text-right text-[0.6875rem]" />
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden">
        {sectors.map((s, i) => (
          <span
            key={s.sector}
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[0.625rem] text-muted-foreground",
              // Fewer pills on the smaller cards (tablet cards are the narrowest).
              i > 1 && "max-lg:hidden",
              i === 1 && "md:max-lg:hidden",
            )}
          >
            {s.sector} <span className="font-mono text-foreground tabular-nums">{s.count}</span>
          </span>
        ))}
        <LiveStamp className="ml-auto shrink-0 text-[0.625rem]" />
      </div>
    </>
  );
}
