"use client";

import { Liveline } from "liveline";
import { useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ALL_MINTS, useMarket } from "@/hooks/use-market";
import { useResolvedTheme } from "@/hooks/use-theme";
import { MARKET_TOKENS, WINDOWS, type MarketToken } from "@/lib/market/config";
import { chartPoints, formatPrice } from "@/lib/market/series";
import { cn } from "@/lib/utils";

import { changeColor } from "./chart-colors";
import { ChangePill } from "./hero-chart";
import { TokenLogo } from "./token-logo";

type Tab = "crypto" | "stocks" | "movers";
const TABS: { id: Tab; label: string }[] = [
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Stocks" },
  { id: "movers", label: "Top movers" },
];

/**
 * Cards for every dashboard token, with tabs, above the chart: picking one
 * shows it in the chart. On phones the cards are one swipeable row, so the
 * chart stays near the top.
 */
export function MarketGrid({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (mint: string) => void;
}) {
  const market = useMarket();
  const [tab, setTab] = useState<Tab>("crypto");
  const { requestHistory } = market;

  // One batched history request for every card's sparkline.
  useEffect(() => requestHistory("24h", ALL_MINTS), [requestHistory]);

  const tokens = useMemo(() => {
    if (tab === "crypto") return MARKET_TOKENS.filter((t) => t.kind === "crypto");
    if (tab === "stocks") return MARKET_TOKENS.filter((t) => t.kind === "stock");
    // Biggest 24h moves either way; tokens without a change yet go last.
    return [...MARKET_TOKENS].sort(
      (a, b) =>
        Math.abs(market.prices[b.mint]?.change24h ?? -1) -
        Math.abs(market.prices[a.mint]?.change24h ?? -1),
    );
  }, [tab, market.prices]);

  return (
    <section aria-labelledby="markets-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="markets-heading" className="text-lg font-semibold">
          Markets
        </h2>
        <div
          role="tablist"
          aria-label="Market"
          className="flex rounded-lg border bg-muted/40 p-0.5"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-[background-color,color,transform] active:scale-95",
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-primary-text hover:bg-primary/8",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {tokens.map((token) => (
          <li key={token.mint} className="w-64 shrink-0 snap-start sm:w-auto">
            <MarketCard
              token={token}
              active={token.mint === selected}
              onSelect={() => onSelect(token.mint)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MarketCard({
  token,
  active,
  onSelect,
}: {
  token: MarketToken;
  active: boolean;
  onSelect: () => void;
}) {
  const market = useMarket();
  const theme = useResolvedTheme();
  const entry = market.history("24h", token.mint);
  const candles = useMemo(() => (entry.state === "ready" ? entry.candles : []), [entry]);
  const ticks = market.ticks[token.mint];
  const points = useMemo(
    () => chartPoints(candles, ticks ?? [], WINDOWS["24h"].secs),
    [candles, ticks],
  );
  const live = market.prices[token.mint] ?? null;
  const price = live?.price ?? candles.at(-1)?.close ?? null;
  const change = live?.change24h ?? null;
  const stats = market.stats?.[token.mint];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-controls="market-chart"
      aria-label={`Show ${token.name} in the chart`}
      className={cn(
        "group w-full card-lift rounded-xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // The market the chart is showing: a navy card with white text.
        // Its focus ring is gray, which shows on both white and black pages.
        active
          ? "theme-navy border-[var(--navy)] focus-visible:ring-[var(--gray)] focus-visible:ring-offset-0"
          : "bg-card",
      )}
    >
      <div className="flex items-center gap-2.5">
        <TokenLogo src={stats?.icon} symbol={token.symbol} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{token.name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{token.symbol}</span>
            {token.kind === "stock" && " · Stock"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {price === null ? (
          <Skeleton className="h-6 w-24" />
        ) : (
          <span className="font-mono text-lg font-semibold tabular-nums">{formatPrice(price)}</span>
        )}
        <ChangePill change={change} className="text-xs" />
      </div>
      <div className="mt-3 h-14" aria-hidden>
        <Liveline
          data={points}
          value={price ?? 0}
          // On the navy (selected) card, draw in the dark theme's light colours.
          theme={active ? "dark" : theme}
          color={changeColor(change, active ? "dark" : theme)}
          window={WINDOWS["24h"].secs}
          grid={false}
          badge={false}
          scrub={false}
          momentum={false}
          pulse={false}
          exaggerate
          degen={false}
          lineWidth={1.5}
          padding={{ top: 4, right: 4, bottom: 4, left: 4 }}
          loading={entry.state === "loading" && points.length === 0}
          paused={market.status === "paused" || market.status === "error"}
          emptyText="No price history"
          cursor="pointer"
        />
      </div>
    </button>
  );
}
