"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";

import { TokenLogo } from "@/components/market/token-logo";
import { ChangeText, LiveNumber } from "@/components/markets/live-number";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/market/series";
import { cn } from "@/lib/utils";

import { HERO_WINDOW, useHeroRotation } from "./hero-rotation";
import { PauseOffscreen } from "./hover-text";
import { LiveStamp, useHomeMarket, useWatch } from "./live/home-market";

// The charting library loads after the page, so the hero's text isn't waiting on it.
const PriceChart = dynamic(
  () => import("@/components/markets/price-chart").then((m) => m.PriceChart),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-xl opacity-60" /> },
);

const FADE = { duration: 0.35, ease: "easeOut" } as const;

/**
 * The hero's picture of what Quill does, read left to right as ask → data →
 * trade: a live 7-day chart that moves through the most traded stocks every
 * 20 s (see useHeroRotation), a question about the stock on show floating
 * over it, and a REAL Jupiter quote for 10 USDC of that stock. Pills name the
 * stocks in rotation and jump to one. The overlays drift gently; under
 * reduced motion nothing moves or rotates and the pills switch stocks.
 */
export function HeroVisual() {
  const { overview, failed, stocks: rows } = useHomeMarket();
  const { stocks, stock, quote, auto, jump, hold, bar } = useHeroRotation();
  // Every stock in rotation rides the page's one batched price request.
  useWatch("hero", [...new Set([stock.ticker, ...stocks.map((s) => s.ticker)])]);
  const row = rows.find((r) => r.ticker === stock.ticker);

  return (
    <PauseOffscreen className="relative aspect-[800/460] min-h-[24rem] w-full">
      <div
        {...hold}
        className="absolute inset-0 flex flex-col overflow-hidden rounded-3xl border bg-card/70 p-4 shadow-[0_0_120px_-30px_rgb(59_91_219/0.55)] backdrop-blur sm:p-6"
      >
        {/* Keyed by stock, so the header fades to the next one. */}
        <motion.div
          key={stock.ticker}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={FADE}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          <div className="flex items-center gap-3 text-left">
            <TokenLogo src={stock.icon ?? row?.icon} symbol={stock.ticker} className="size-9" />
            <div>
              <p className="text-sm leading-tight font-semibold">{stock.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {stock.symbol} · last 7 days
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
                  value={row?.price ?? null}
                  format={formatPrice}
                  className="text-xl font-semibold sm:text-2xl"
                />
                <span className="text-sm">
                  <ChangeText value={row?.change24h ?? null} />
                  <span className="ml-1 font-mono text-xs text-muted-foreground">24h</span>
                </span>
              </p>
            )}
            <LiveStamp className="whitespace-nowrap" />
          </div>
        </motion.div>

        {/* The 20 s until the next stock (filled by the rotation clock), then the stocks in rotation. */}
        {auto && (
          <span aria-hidden className="mt-3 block h-0.5 overflow-hidden rounded-full bg-border">
            <span
              ref={bar}
              className="block h-full origin-left scale-x-0 rounded-full bg-[var(--label-blue)]"
            />
          </span>
        )}
        {stocks.length > 1 && (
          <div
            role="group"
            aria-label="Stocks in rotation"
            className="mt-2.5 flex [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          >
            {stocks.map((s) => (
              <button
                key={s.ticker}
                type="button"
                aria-pressed={s.ticker === stock.ticker}
                aria-label={`Show ${s.name}`}
                onClick={() => jump(s.ticker)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  s.ticker === stock.ticker
                    ? "border-[rgb(143_164_255/0.5)] bg-surface-raised text-foreground"
                    : "border-transparent text-muted-foreground hover:text-white",
                )}
              >
                {s.ticker}
              </button>
            ))}
          </div>
        )}

        <div className="relative mt-3 min-h-0 flex-1">
          <PriceChart ticker={stock.ticker} fixedWindow={HERO_WINDOW} />
        </div>
      </div>

      {/* Ask: a question about the stock on show, floating over the chart's left side. */}
      <div className="pointer-events-none absolute top-[47%] -left-1 motion-safe:animate-float sm:top-[38%] sm:left-[5%]">
        <p className="rounded-2xl rounded-bl-md border bg-surface-raised/95 px-4 py-2.5 text-left text-sm shadow-lift backdrop-blur">
          <span className="block font-mono text-[10px] tracking-[0.14em] text-[var(--label-blue)] uppercase">
            You ask
          </span>
          <motion.span
            key={stock.ticker}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={FADE}
            className="block"
          >
            {stock.question}
          </motion.span>
        </p>
      </div>

      {/* Trade: a real quote for the same stock, lower right, a step after the question. */}
      <div className="pointer-events-none absolute -right-1 bottom-[16%] [animation-delay:-3s] motion-safe:animate-float sm:right-[9%]">
        <div className="min-w-44 rounded-2xl border border-[rgb(143_164_255/0.3)] bg-background/95 px-4 py-3 text-left shadow-lift backdrop-blur">
          <p className="font-mono text-[10px] tracking-[0.14em] text-[var(--label-blue)] uppercase">
            Live Jupiter quote
          </p>
          {quote?.quote ? (
            <motion.p
              key={quote.quote.ticker}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={FADE}
              className="mt-1 flex items-center gap-1.5 font-mono text-sm tabular-nums"
              aria-live="polite"
            >
              {quote.quote.usdcIn} USDC
              <ArrowRight className="size-3.5 text-muted-foreground" aria-label="buys" />
              <span className="font-semibold">
                {quote.quote.tokensOut.toLocaleString("en-US", { maximumSignificantDigits: 3 })}{" "}
                {quote.quote.symbol}
              </span>
            </motion.p>
          ) : quote?.failed ? (
            <p className="mt-1 text-sm text-muted-foreground">Data unavailable</p>
          ) : (
            <Skeleton className="mt-1.5 h-5 w-40" />
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">A quote, not a trade</p>
        </div>
      </div>
    </PauseOffscreen>
  );
}
