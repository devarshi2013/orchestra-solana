"use client";

import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";

import { TokenLogo } from "@/components/market/token-logo";
import { ChangeText, LiveNumber } from "@/components/markets/live-number";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/market/series";

import { PauseOffscreen } from "./hover-text";
import { LiveStamp, useHomeMarket, useWatch } from "./live/home-market";
import { useExampleQuote } from "./live/use-example-quote";

const TICKER = "NVDA";

// The charting library loads after the page, so the hero's text isn't waiting on it.
const PriceChart = dynamic(
  () => import("@/components/markets/price-chart").then((m) => m.PriceChart),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-xl opacity-60" /> },
);

/**
 * The hero's picture of what Quill does, read left to right as ask → data →
 * trade: a live NVDA chart (price, 24h change, last 7 days), a question
 * floating over it, and a REAL Jupiter quote for 10 USDC of the same stock.
 * The overlays drift gently; under reduced motion they stay still.
 */
export function HeroVisual() {
  const { overview, failed, stocks } = useHomeMarket();
  useWatch("hero", [TICKER]);
  const stock = stocks.find((s) => s.ticker === TICKER);
  const { quote, failed: quoteFailed } = useExampleQuote();

  return (
    <PauseOffscreen className="relative aspect-[800/460] min-h-[24rem] w-full">
      <div className="absolute inset-0 flex flex-col overflow-hidden rounded-3xl border bg-card/70 p-4 shadow-[0_0_120px_-30px_rgb(59_91_219/0.55)] backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 text-left">
            <TokenLogo src={stock?.icon} symbol={TICKER} className="size-9" />
            <div>
              <p className="text-sm leading-tight font-semibold">{stock?.name ?? "NVIDIA"}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {stock?.chartSymbol ?? TICKER} · last 7 days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {failed ? (
              <p className="text-sm text-muted-foreground">Data unavailable</p>
            ) : !overview ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              <p className="flex items-baseline gap-2.5" aria-live="polite">
                <LiveNumber
                  value={stock?.price ?? null}
                  format={formatPrice}
                  className="text-xl font-semibold sm:text-2xl"
                />
                <span className="text-sm">
                  <ChangeText value={stock?.change24h ?? null} />
                  <span className="ml-1 font-mono text-xs text-muted-foreground">24h</span>
                </span>
              </p>
            )}
            <LiveStamp />
          </div>
        </div>
        <div className="relative mt-3 min-h-0 flex-1">
          <PriceChart ticker={TICKER} fixedWindow="7d" />
        </div>
      </div>

      {/* Ask: the question, floating over the chart's left side. */}
      <div className="pointer-events-none absolute top-[30%] -left-1 motion-safe:animate-float sm:left-[5%]">
        <p className="rounded-2xl rounded-bl-md border bg-surface-raised/95 px-4 py-2.5 text-left text-sm shadow-lift backdrop-blur">
          <span className="block font-mono text-[10px] tracking-[0.14em] text-[var(--label-blue)] uppercase">
            You ask
          </span>
          Top 3 tech stocks, $10 each?
        </p>
      </div>

      {/* Trade: a real quote, lower right, a step after the question. */}
      <div className="pointer-events-none absolute -right-1 bottom-[16%] [animation-delay:-3s] motion-safe:animate-float sm:right-[9%]">
        <div className="min-w-44 rounded-2xl border border-[rgb(143_164_255/0.3)] bg-background/95 px-4 py-3 text-left shadow-lift backdrop-blur">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--label-blue)] uppercase">
            Live Jupiter quote
          </p>
          {quoteFailed ? (
            <p className="mt-1 text-sm text-muted-foreground">Data unavailable</p>
          ) : !quote ? (
            <Skeleton className="mt-1.5 h-5 w-40" />
          ) : (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-sm tabular-nums">
              {quote.usdcIn} USDC
              <ArrowRight className="size-3.5 text-muted-foreground" aria-label="buys" />
              <span className="font-semibold">
                {quote.tokensOut.toLocaleString("en-US", { maximumSignificantDigits: 3 })}{" "}
                {quote.symbol}
              </span>
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">A quote, not a trade</p>
        </div>
      </div>
    </PauseOffscreen>
  );
}
