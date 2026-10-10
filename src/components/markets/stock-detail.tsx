"use client";

import { useEffect, useState } from "react";

import { TokenLogo } from "@/components/market/token-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson, useLivePrices, useMarketList } from "@/hooks/use-markets";
import { formatCompact, formatCompactUsd, formatPrice, type Candle } from "@/lib/market/series";

import { ChangeText, LiveNumber } from "./live-number";
import { PriceChart } from "./price-chart";
import { TradePanel, type TradeToken } from "./trade-panel";

/**
 * A stock's page: logo, name, ticker, live price and 24h change; the price
 * chart; a stats grid; and the trade panel (beside the chart on wide screens,
 * below it on phones).
 */
export function StockDetail({ token, name }: { token: TradeToken; name: string }) {
  const { rows } = useMarketList();
  const row = rows?.find((r) => r.ticker === token.ticker) ?? null;
  const live = useLivePrices([token.ticker])[token.ticker];
  const price = live?.price ?? row?.price ?? null;
  const change = live?.change24h ?? row?.change24h ?? null;
  const range = useDayRange(token.ticker);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <TokenLogo src={row?.icon} symbol={token.ticker} className="size-12" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
              <p className="font-mono text-sm text-muted-foreground">
                {token.ticker} · {token.symbol} ({token.issuer})
              </p>
            </div>
          </div>
          <div className="text-right">
            {price === null && !rows ? (
              <Skeleton className="h-9 w-36" />
            ) : (
              <LiveNumber value={price} format={formatPrice} className="text-3xl font-semibold" />
            )}
            <p className="text-sm">
              <ChangeText value={change} /> <span className="text-muted-foreground">24h</span>
            </p>
          </div>
        </header>

        <PriceChart ticker={token.ticker} />

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
          <Stat
            label="Market cap (on-chain)"
            value={row ? formatCompactUsd(row.marketCap) : null}
          />
          <Stat label="24h volume" value={row ? formatCompactUsd(row.volume24h) : null} />
          <Stat label="Holders" value={row ? formatCompact(row.holders) : null} />
          <Stat
            label="24h high"
            value={range ? formatPrice(range.high) : range === null ? "—" : null}
          />
          <Stat
            label="24h low"
            value={range ? formatPrice(range.low) : range === null ? "—" : null}
          />
          <Stat label="Liquidity" value={row ? formatCompactUsd(row.liquidity) : null} />
        </dl>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <TradePanel token={token} />
      </aside>
    </div>
  );
}

/** The last 24h's high and low, from the same history as the 1D chart (undefined while loading). */
function useDayRange(ticker: string) {
  const [range, setRange] = useState<{ high: number; low: number } | null | undefined>(undefined);
  useEffect(() => {
    const abort = new AbortController();
    getJson<{ candles: Candle[] }>(
      `/api/markets/history?ticker=${encodeURIComponent(ticker)}&window=24h`,
      abort.signal,
    )
      .then(({ candles }) =>
        setRange(
          candles.length
            ? {
                high: Math.max(...candles.map((c) => c.high)),
                low: Math.min(...candles.map((c) => c.low)),
              }
            : null,
        ),
      )
      .catch(() => {
        if (!abort.signal.aborted) setRange(null);
      });
    return () => abort.abort();
  }, [ticker]);
  return range;
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
        {value ?? <Skeleton className="h-4 w-16" />}
      </dd>
    </div>
  );
}
