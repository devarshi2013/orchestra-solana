"use client";

import { Liveline } from "liveline";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { useMarket, type PriceStatus } from "@/hooks/use-market";
import { useResolvedTheme } from "@/hooks/use-theme";
import {
  MARKET_TOKENS,
  WINDOWS,
  WINDOW_IDS,
  candleSecs,
  marketToken,
  type WindowId,
} from "@/lib/market/config";
import {
  chartPoints,
  closedCandles,
  formatCompact,
  formatCompactUsd,
  formatPct,
  formatPrice,
  liveCandle,
} from "@/lib/market/series";
import { cn } from "@/lib/utils";

import { changeColor } from "./chart-colors";
import { TokenLogo } from "./token-logo";

const WINDOW_OPTIONS = WINDOW_IDS.map((id) => ({
  label: WINDOWS[id].label,
  secs: WINDOWS[id].secs,
}));

const timeFormatter = (window: WindowId) => {
  const fmt =
    window === "1h" || window === "24h"
      ? new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return (t: number) => fmt.format(new Date(t * 1000));
};

/** Where the one call to action goes: the chat, asking about the stock on screen. */
export function chatHref(mint: string) {
  const token = marketToken(mint);
  // The assistant researches tokenized stocks, so only those pre-fill a question.
  return token?.ticker ? `/chat?q=${encodeURIComponent(`Tell me about ${token.ticker}`)}` : "/chat";
}

/**
 * The big live chart: token switcher, live price with 24h change, a Liveline
 * chart (line or candles, 1H to 30D), the token's stats, and the page's only
 * button into the chat.
 */
export function HeroChart({ mint, onSelect }: { mint: string; onSelect: (mint: string) => void }) {
  const market = useMarket();
  const theme = useResolvedTheme();
  const nowSec = Math.floor(useNow() / 1000);
  // Liveline starts on its first window button (1H) and keeps that state itself; match it.
  const [windowId, setWindowId] = useState<WindowId>(WINDOW_IDS[0]!);
  const [chartMode, setChartMode] = useState<"line" | "candle">("line");
  const token = marketToken(mint)!;
  const window = WINDOWS[windowId];
  const { requestHistory } = market;

  useEffect(() => requestHistory(windowId, [mint]), [requestHistory, windowId, mint]);

  const entry = market.history(windowId, mint);
  const candles = useMemo(() => (entry.state === "ready" ? entry.candles : []), [entry]);
  const ticks = market.ticks[mint];
  const points = useMemo(
    () => chartPoints(candles, ticks ?? [], window.secs),
    [candles, ticks, window.secs],
  );
  const live = market.prices[mint] ?? null;
  const price = live?.price ?? candles.at(-1)?.close ?? null;
  const width = candleSecs(window);
  const stats = market.stats?.[mint] ?? null;
  const change = live?.change24h ?? null;

  const historyFailed = entry.state === "failed";
  const noData = points.length === 0;
  const emptyText =
    market.status === "error"
      ? "Prices are unavailable right now. Retrying…"
      : historyFailed
        ? "Price history is unavailable. Waiting for live prices…"
        : "No price data yet";

  return (
    <section aria-labelledby="hero-heading" className="rounded-2xl border bg-card p-4 sm:p-6">
      {/* Token switcher */}
      <div
        role="tablist"
        aria-label="Token"
        className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {MARKET_TOKENS.map((t) => {
          const active = t.mint === mint;
          return (
            <button
              key={t.mint}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(t.mint)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-[background-color,border-color,color] duration-300 ease-in-out",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/50 bg-surface text-primary-text hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <TokenLogo src={market.stats?.[t.mint]?.icon} symbol={t.symbol} className="size-4" />
              {t.symbol}
            </button>
          );
        })}
      </div>

      {/* Name, live price, 24h change, the call to action */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2.5">
            <TokenLogo src={stats?.icon} symbol={token.symbol} className="size-9" />
            <div className="min-w-0">
              <h2 id="hero-heading" className="truncate text-lg leading-tight font-semibold">
                {token.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {token.symbol} · {token.kind === "stock" ? "Tokenized stock" : "Solana token"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {price === null ? (
              <Skeleton className="h-10 w-44" />
            ) : (
              <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {formatPrice(price)}
              </span>
            )}
            <ChangePill change={change} />
            <LiveStatus status={market.status} />
          </div>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={chatHref(mint)}>
            <Sparkles />
            {token.ticker ? `Ask Quill about ${token.ticker}` : "Ask Quill"}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>

      {/* The chart: a fixed-height box Liveline fills */}
      <div
        className="liveline-controls mt-5 flex h-80 flex-col sm:h-[26rem]"
        aria-label={`${token.symbol} price chart, ${window.label}`}
      >
        <Liveline
          data={points}
          value={price ?? 0}
          theme={theme}
          // The line follows the 24h move (green/red), never the burgundy brand colour.
          color={changeColor(change, theme)}
          window={window.secs}
          windows={WINDOW_OPTIONS}
          onWindowChange={(secs) =>
            setWindowId(WINDOW_IDS.find((id) => WINDOWS[id].secs === secs) ?? "24h")
          }
          windowStyle="rounded"
          mode={candles.length > 0 ? "candle" : "line"}
          candles={closedCandles(candles, width, nowSec)}
          candleWidth={width}
          liveCandle={liveCandle(candles, width, live?.price ?? null, nowSec) ?? undefined}
          lineMode={chartMode === "line"}
          lineData={points}
          lineValue={price ?? undefined}
          onModeChange={candles.length > 0 ? setChartMode : undefined}
          momentum
          pulse
          exaggerate
          degen={false}
          loading={entry.state === "loading" && noData}
          paused={market.status === "paused" || market.status === "error"}
          emptyText={emptyText}
          formatValue={formatPrice}
          formatTime={timeFormatter(windowId)}
          // Liveline renders its button row above the canvas: let the canvas take what's left.
          style={{ height: "auto", flex: "1 1 0%", minHeight: 0 }}
        />
      </div>
      {historyFailed && !noData && (
        <p className="mt-2 text-xs text-muted-foreground">
          Price history is unavailable right now; showing live prices since you opened the page.
        </p>
      )}

      {/* Stats Jupiter returns for this token */}
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        <Stat
          label={token.kind === "stock" ? "Market cap (on-chain)" : "Market cap"}
          title={
            token.kind === "stock"
              ? "Tokens on Solana × price, not the company's market cap"
              : undefined
          }
          value={stats ? formatCompactUsd(stats.marketCap) : null}
          error={market.statsError}
        />
        <Stat
          label="24h volume"
          value={stats ? formatCompactUsd(stats.volume24h) : null}
          error={market.statsError}
        />
        <Stat
          label="Liquidity"
          value={stats ? formatCompactUsd(stats.liquidity) : null}
          error={market.statsError}
        />
        <Stat
          label="Holders"
          value={stats ? formatCompact(stats.holders) : null}
          error={market.statsError}
        />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  error,
  title,
}: {
  label: string;
  value: string | null;
  error: boolean;
  title?: string;
}) {
  return (
    <div className="bg-card px-4 py-3" title={title}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-medium tabular-nums">
        {value ?? (error ? "Unavailable" : <Skeleton className="h-4 w-16" />)}
      </dd>
    </div>
  );
}

export function ChangePill({ change, className }: { change: number | null; className?: string }) {
  if (change === null) return null;
  const up = change >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-sm font-medium tabular-nums",
        up
          ? "bg-success/6 text-success dark:bg-success/12"
          : "bg-destructive/6 text-destructive dark:bg-destructive/12",
        className,
      )}
      title="Change over the last 24 hours"
    >
      <span aria-hidden className="mr-0.5 text-[0.85em]">
        {up ? "▲" : "▼"}
      </span>
      {formatPct(change)}
      <span className="ml-1 text-[0.7em] font-normal opacity-80">24h</span>
    </span>
  );
}

function LiveStatus({ status }: { status: PriceStatus }) {
  const label =
    status === "live"
      ? "Live"
      : status === "paused"
        ? "Paused"
        : status === "error"
          ? "Reconnecting…"
          : "Connecting…";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <span className="relative flex size-2">
        {status === "live" && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            status === "live"
              ? "bg-success"
              : status === "error"
                ? "bg-destructive"
                : "bg-muted-foreground",
          )}
        />
      </span>
      {label}
    </span>
  );
}
