"use client";

import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { TokenLogo } from "@/components/market/token-logo";
import { ChangeText, LiveNumber } from "@/components/markets/live-number";
import { Sparkline } from "@/components/markets/sparkline";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useSparklines } from "@/hooks/use-markets";
import { formatCompact, formatCompactUsd, formatPrice, type Point } from "@/lib/market/series";
import { HOME_ROWS, HOME_TABS, type HomeSortKey } from "@/lib/markets/home";
import type { MarketRow } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

import { LiveStamp, useHomeMarket } from "./home-market";
import { MarketHoursBadge } from "./market-hours-badge";

const COLUMNS: { key: HomeSortKey; label: string; numeric: boolean; wide?: boolean }[] = [
  { key: "name", label: "Asset", numeric: false },
  { key: "price", label: "Price", numeric: true },
  { key: "change", label: "24h %", numeric: true },
  { key: "volume", label: "24h volume", numeric: true, wide: true },
  { key: "marketCap", label: "Market cap", numeric: true, wide: true },
];

/**
 * The home page's markets table: Stocks / ETFs / Crypto / Top gainers / Top
 * losers, ten rows, sortable columns, a 7-day sparkline, and a drawer with a
 * row's details. Prices come from the page's shared poller. "View all" goes
 * to the full screener.
 */
export function HomeMarkets() {
  const market = useHomeMarket();
  const { overview, failed, tab, setTab, sector, setSector, sort, setSort, tableRows } = market;
  const [open, setOpen] = useState<string | null>(null);
  const sparklines = useSparklines(
    tableRows.map((r) => r.ticker),
    "7d",
  );
  const selected = tableRows.find((r) => r.ticker === open) ?? null;

  const toggleSort = (key: HomeSortKey) =>
    setSort(
      sort?.key === key
        ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  return (
    <section
      id="markets"
      aria-labelledby="home-markets-heading"
      className="scroll-mt-20 px-4 pb-24 sm:px-6 sm:pb-32"
    >
      <Reveal className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <h2
              id="home-markets-heading"
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Markets
            </h2>
            <MarketHoursBadge />
          </div>
          <LiveStamp />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Market" className="flex gap-1 overflow-x-auto">
            {HOME_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setSort(null);
                }}
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
          {sector && tab !== "crypto" && (
            <button
              type="button"
              onClick={() => setSector(null)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-foreground transition-colors outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sector: {sector} <X className="size-3.5" aria-label="Clear sector filter" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {COLUMNS.map((c) => {
                  const active = sort?.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      aria-sort={
                        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
                      }
                      className={cn(
                        "px-4 py-3 font-medium",
                        c.numeric && "text-right",
                        c.wide && "hidden md:table-cell",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring",
                          active && "text-foreground",
                        )}
                      >
                        {c.label} <Icon className="size-3.5" aria-hidden />
                      </button>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-right font-medium">Last 7 days</th>
              </tr>
            </thead>
            <tbody>
              {failed ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Data unavailable
                  </td>
                </tr>
              ) : !overview ? (
                Array.from({ length: HOME_ROWS }, (_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </td>
                    {[0, 1].map((j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </td>
                    ))}
                    {[0, 1].map((j) => (
                      <td key={j} className="hidden px-4 py-3 md:table-cell">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-8 w-24" />
                    </td>
                  </tr>
                ))
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Nothing to show here right now.
                  </td>
                </tr>
              ) : (
                tableRows.map((r) => (
                  <tr
                    key={r.ticker}
                    onClick={() => setOpen(r.ticker)}
                    className="group cursor-pointer border-b transition-colors duration-200 last:border-0 hover:bg-surface-raised"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TokenLogo src={r.icon} symbol={r.ticker} className="size-8" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(r.ticker);
                            }}
                            aria-label={`${r.name}: open details`}
                            className="block max-w-44 truncate text-left font-medium outline-none group-hover:text-white focus-visible:underline"
                          >
                            {r.name}
                          </button>
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.ticker}
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
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">
                      {formatCompactUsd(r.volume24h)}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">
                      {formatCompactUsd(r.marketCap)}
                    </td>
                    <td className="px-4 py-3">
                      <Sparkline points={sparklines[r.ticker]} className="ml-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Prices, volume and market cap from Jupiter; market cap is on-chain (tokens on Solana ×
            price). 7-day history from GeckoTerminal.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/markets">
              View all <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </Reveal>

      <AssetDrawer
        row={selected}
        sparkline={selected ? sparklines[selected.ticker] : undefined}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}

/** A row's details in a side drawer: live price, 7-day line, Jupiter's stats, and a link to the full stock page. */
function AssetDrawer({
  row,
  sparkline,
  onClose,
}: {
  row: MarketRow | null;
  sparkline: Point[] | null | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet open={row !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        {row && (
          <div className="flex h-full flex-col overflow-y-auto p-6" data-lenis-prevent>
            <SheetHeader className="p-0">
              <div className="flex items-center gap-3">
                <TokenLogo src={row.icon} symbol={row.ticker} className="size-11" />
                <div>
                  <SheetTitle className="text-xl">{row.name}</SheetTitle>
                  <SheetDescription className="font-mono text-xs">
                    {row.ticker}
                    {row.category !== "crypto" && ` · ${row.symbol} (${row.issuer})`}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 flex items-end justify-between gap-3">
              <LiveNumber
                value={row.price}
                format={formatPrice}
                className="text-3xl font-semibold"
              />
              <p className="text-sm">
                <ChangeText value={row.change24h} />{" "}
                <span className="text-muted-foreground">24h</span>
              </p>
            </div>
            <div className="mt-4 rounded-xl border bg-card p-4">
              <p className="mb-2 text-xs text-muted-foreground">Last 7 days</p>
              <Sparkline points={sparkline} className="h-20 w-full" />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border text-sm">
              {[
                ["Market cap (on-chain)", formatCompactUsd(row.marketCap)],
                ["24h volume", formatCompactUsd(row.volume24h)],
                ["Holders", formatCompact(row.holders)],
                ["Liquidity", formatCompactUsd(row.liquidity)],
                ["Sector", row.sector],
                ["Trades", row.hours],
              ].map(([label, value]) => (
                <div key={label} className="bg-card px-3.5 py-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-mono tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <LiveStamp className="mt-3" />

            {row.category !== "crypto" && (
              <Button asChild className="mt-6 w-full">
                <Link href={`/markets/${row.ticker}`}>
                  Open {row.ticker} page <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Research only. Not financial advice.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
