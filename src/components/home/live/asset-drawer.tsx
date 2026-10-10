"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { TokenLogo } from "@/components/market/token-logo";
import { ChangeText, LiveNumber } from "@/components/markets/live-number";
import { Sparkline } from "@/components/markets/sparkline";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSparklines } from "@/hooks/use-markets";
import { formatCompact, formatCompactUsd, formatPrice } from "@/lib/market/series";

import { LiveStamp, useHomeMarket } from "./home-market";

/**
 * The asset details drawer, shared by the markets table and the search card:
 * live price, 7-day line, Jupiter's stats, and a link to the full stock page.
 * Rendered once inside the provider; opened with `openAsset(ticker)`.
 */
export function AssetDrawer() {
  const { selected: row, closeAsset } = useHomeMarket();
  const sparkline = useSparklines(row ? [row.ticker] : [], "7d")[row?.ticker ?? ""];
  return (
    <Sheet open={row !== null} onOpenChange={(next) => !next && closeAsset()}>
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
