"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { TokenLogo } from "@/components/market/token-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useLivePrices, useMarketList, useSparklines } from "@/hooks/use-markets";
import { formatCompactUsd, formatPrice } from "@/lib/market/series";
import type { MarketCategory, MarketRow } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

import { ChangeText, LiveNumber } from "./live-number";
import { Sparkline } from "./sparkline";
import { TopPerformers } from "./top-performers";

const TABS: { id: "all" | MarketCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "equity", label: "Equities" },
  { id: "etf", label: "ETFs" },
  { id: "commodity", label: "Commodities" },
];

type SortKey = "name" | "price" | "change" | "marketCap" | "volume";
const COLUMNS: { key: SortKey; label: string; numeric: boolean; wide?: boolean }[] = [
  { key: "name", label: "Company", numeric: false },
  { key: "price", label: "Price", numeric: true },
  { key: "change", label: "24h %", numeric: true },
  { key: "marketCap", label: "Market cap", numeric: true, wide: true },
  { key: "volume", label: "24h volume", numeric: true, wide: true },
];

const value = (r: MarketRow, key: SortKey): number | string | null =>
  key === "name"
    ? r.name
    : key === "price"
      ? r.price
      : key === "change"
        ? r.change24h
        : key === "marketCap"
          ? r.marketCap
          : r.volume24h;

/**
 * The stocks screener: search ("/" to focus), category tabs, the top
 * performers, and a sortable table. Prices for the rows on screen update every
 * 12 s (only while the tab is visible); each row opens its stock page.
 */
export function Screener() {
  const router = useRouter();
  const { rows, error } = useMarketList();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "marketCap",
    dir: "desc",
  });
  const [onScreen, setOnScreen] = useState<string[]>([]);
  const search = useRef<HTMLInputElement>(null);
  const table = useRef<HTMLTableSectionElement>(null);

  // "/" focuses the search box (unless you're already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const prices = useLivePrices(onScreen);
  const live = useMemo(
    () =>
      (rows ?? []).map((r) => {
        const p = prices[r.ticker];
        return p ? { ...r, price: p.price, change24h: p.change24h ?? r.change24h } : r;
      }),
    [rows, prices],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = live.filter(
      (r) =>
        (tab === "all" || r.category === tab) &&
        (!q ||
          r.ticker.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.symbol.toLowerCase().includes(q)),
    );
    const sign = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
      return typeof va === "string"
        ? sign * va.localeCompare(vb as string)
        : sign * (va - (vb as number));
    });
  }, [live, query, tab, sort]);

  // Which rows are on screen: their prices poll and their sparklines load.
  useEffect(() => {
    const body = table.current;
    if (!body) return;
    const visible = new Set<string>();
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const ticker = (entry.target as HTMLElement).dataset.ticker!;
          if (entry.isIntersecting) visible.add(ticker);
          else visible.delete(ticker);
        }
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setOnScreen([...visible].slice(0, 40)));
      },
      { rootMargin: "200px 0px" },
    );
    body.querySelectorAll("tr[data-ticker]").forEach((tr) => observer.observe(tr));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [shown]);

  const sparklines = useSparklines(onScreen);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stocks…"
          aria-label="Search stocks"
          className="h-11 w-full rounded-xl border border-input bg-card pr-12 pl-10 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-[var(--label-blue)] focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border bg-surface-raised px-1.5 font-mono text-xs text-muted-foreground">
          /
        </kbd>
      </div>

      {rows && <TopPerformers rows={live} />}

      <div className="space-y-3">
        <div role="tablist" aria-label="Category" className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === t.id
                  ? "bg-surface-raised text-foreground"
                  : "text-muted-foreground hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && !rows ? (
          <p role="alert" className="rounded-xl border bg-card p-6 text-sm text-danger">
            {error}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {COLUMNS.map((c, i) => (
                    <Th
                      key={c.key}
                      column={c}
                      sort={sort}
                      onSort={toggleSort}
                      className={cn(c.wide && "hidden md:table-cell")}
                      // The sparkline sits between 24h % and market cap.
                      after={i === 2 ? <th className="px-4 py-3 font-medium">Last 24h</th> : null}
                    />
                  ))}
                </tr>
              </thead>
              <tbody ref={table}>
                {!rows
                  ? Array.from({ length: 10 }, (_, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Skeleton className="size-8 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </td>
                        {[0, 1, 2].map((j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </td>
                        ))}
                        {[0, 1].map((j) => (
                          <td key={j} className="hidden px-4 py-3 md:table-cell">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : shown.map((r) => (
                      <tr
                        key={r.ticker}
                        data-ticker={r.ticker}
                        onClick={() => router.push(`/markets/${r.ticker}`)}
                        className="group cursor-pointer border-b transition-colors duration-200 last:border-0 hover:bg-surface-raised"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <TokenLogo src={r.icon} symbol={r.ticker} className="size-8" />
                            <div className="min-w-0">
                              <Link
                                href={`/markets/${r.ticker}`}
                                onClick={(e) => e.stopPropagation()}
                                className="block max-w-48 truncate font-medium outline-none group-hover:text-white focus-visible:underline"
                              >
                                {r.name}
                              </Link>
                              <span className="font-mono text-xs text-muted-foreground">
                                {r.ticker}
                                {r.preIpo && " · Pre-IPO"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LiveNumber value={r.price} format={formatPrice} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChangeText value={r.change24h} />
                        </td>
                        <td className="px-4 py-3">
                          <Sparkline points={sparklines[r.ticker]} className="ml-auto" />
                        </td>
                        <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">
                          {formatCompactUsd(r.marketCap)}
                        </td>
                        <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">
                          {formatCompactUsd(r.volume24h)}
                        </td>
                      </tr>
                    ))}
                {rows && shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No stocks match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Market cap is on-chain: tokens on Solana × price, not the company&apos;s market cap.
        </p>
      </div>
    </div>
  );
}

function Th({
  column,
  sort,
  onSort,
  className,
  after,
}: {
  column: (typeof COLUMNS)[number];
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
  after: React.ReactNode;
}) {
  const active = sort.key === column.key;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <>
      <th
        className={cn("px-4 py-3 font-medium", column.numeric && "text-right", className)}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => onSort(column.key)}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring",
            active && "text-foreground",
          )}
        >
          {column.label}
          <Icon className="size-3.5" aria-hidden />
        </button>
      </th>
      {after}
    </>
  );
}
