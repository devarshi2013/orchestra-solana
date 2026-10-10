"use client";

import { Reveal } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { sectorTiles } from "@/lib/markets/home";
import { cn } from "@/lib/utils";

import { LiveStamp, useHomeMarket } from "./home-market";

/** Tile background by the size of the move: stronger colour for bigger averages (text stays white). */
function tone(change: number | null) {
  if (change === null) return "bg-card";
  const strength = Math.abs(change) >= 2 ? "/30" : Math.abs(change) >= 0.75 ? "/20" : "/10";
  return change >= 0 ? `bg-gain${strength}` : `bg-loss${strength}`;
}
// Tailwind needs the full class names somewhere in the source:
// bg-gain/10 bg-gain/20 bg-gain/30 bg-loss/10 bg-loss/20 bg-loss/30

/**
 * One tile per sector, coloured by the real average 24h change of its stocks
 * (only those Jupiter reports a change for; the tile says how many). Clicking
 * a tile filters the markets table to that sector.
 */
export function SectorHeatmap() {
  const { overview, failed, stocks, sector, setSector, setTab, setSort } = useHomeMarket();
  const tiles = sectorTiles(stocks);

  const pick = (name: string) => {
    const next = sector === name ? null : name;
    setSector(next);
    if (next) {
      // Show the tab that has this sector's assets (a few sectors are ETFs only).
      const hasStocks = stocks.some((r) => r.sector === next && r.category === "equity");
      setTab(hasStocks ? "stocks" : "etfs");
      setSort(null);
      document.getElementById("markets")?.scrollIntoView({ block: "start" });
    }
  };

  return (
    <section aria-labelledby="sectors-heading" className="px-4 section-y sm:px-6">
      <Reveal className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <h2 id="sectors-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Sectors today
            </h2>
            <p className="text-sm text-muted-foreground">
              Average 24h change per sector. Pick one to filter the markets table.
            </p>
          </div>
          <LiveStamp />
        </div>

        {failed ? (
          <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Data unavailable
          </p>
        ) : !overview ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map((t) => {
              const up = (t.change ?? 0) >= 0;
              return (
                <li key={t.sector}>
                  <button
                    type="button"
                    onClick={() => pick(t.sector)}
                    aria-pressed={sector === t.sector}
                    className={cn(
                      "flex h-full w-full flex-col gap-2 rounded-xl border p-4 text-left transition-[transform,border-color] duration-300 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5",
                      tone(t.change),
                      sector === t.sector
                        ? "border-foreground"
                        : "hover:border-[rgb(255_255_255/0.24)]",
                    )}
                  >
                    <span className="text-sm font-medium">{t.sector}</span>
                    <span className="font-mono text-xl font-medium tabular-nums">
                      {t.change === null ? (
                        <span className="text-sm text-muted-foreground">No 24h data</span>
                      ) : (
                        <>
                          <span aria-hidden>{up ? "▲" : "▼"}</span> {up ? "+" : "−"}
                          {Math.abs(t.change).toFixed(2)}%
                        </>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.change === null
                        ? `${t.total} ${t.total === 1 ? "stock" : "stocks"}`
                        : `from ${t.counted} of ${t.total} stocks`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </section>
  );
}
