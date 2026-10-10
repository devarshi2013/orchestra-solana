"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/market/series";
import { tapeRows } from "@/lib/markets/home";
import type { MarketRow } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

import { LiveStamp, useHomeMarket } from "./home-market";

/**
 * A scrolling strip of the largest tokenized stocks plus SOL and JUP, with
 * live price and 24h change (sign and arrow, not colour alone). It pauses
 * while hovered or focused; under reduced motion it's a still row you can
 * scroll sideways.
 */
export function TickerTape() {
  const { overview, failed, stocks, crypto } = useHomeMarket();
  const rows = tapeRows(stocks, crypto);

  return (
    <section aria-label="Live prices" className="relative pt-6 sm:pt-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <LiveStamp className="shrink-0" />
        <div className="group relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]">
          {failed ? (
            <p className="py-3 text-sm text-muted-foreground">Data unavailable</p>
          ) : !overview ? (
            <div className="flex gap-6 py-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-36 shrink-0" />
              ))}
            </div>
          ) : (
            <div className="flex w-max will-change-transform group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused] motion-safe:animate-tape">
              <TapeList rows={rows} />
              {/* The second copy makes the loop seamless; hidden from assistive tech and under reduced motion. */}
              <TapeList rows={rows} copy />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TapeList({ rows, copy = false }: { rows: MarketRow[]; copy?: boolean }) {
  return (
    <ul
      aria-hidden={copy || undefined}
      className={cn("flex shrink-0", copy && "motion-reduce:hidden")}
    >
      {rows.map((r) => {
        const up = (r.change24h ?? 0) >= 0;
        return (
          <li
            key={r.ticker}
            className="flex items-baseline gap-2 py-3 pr-8 font-mono text-sm whitespace-nowrap tabular-nums"
          >
            <span className="font-medium text-foreground">{r.ticker}</span>
            <span className="text-muted-foreground">
              {r.price === null ? "—" : formatPrice(r.price)}
            </span>
            {r.change24h !== null && (
              <span className={up ? "text-gain" : "text-loss"}>
                <span aria-hidden>{up ? "▲" : "▼"}</span> {up ? "+" : "−"}
                {Math.abs(r.change24h).toFixed(2)}%
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
