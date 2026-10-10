"use client";

import { animate } from "framer-motion";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Sparkline } from "@/components/markets/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { usMarketClock } from "@/lib/assistant/market-hours";
import { formatPrice } from "@/lib/market/series";
import type { InvestorExtras, NetworkStats } from "@/lib/markets/types";
import { MIN_ORDER_USD } from "@/lib/units";
import { cn } from "@/lib/utils";

import { usePrefersReducedMotion } from "../feature-visuals/visual-frame";
import { LiveStamp, useHomeMarket, useWatch } from "../live/home-market";

/**
 * The live tiles of the "Built for investors" bento. Each is one big visual
 * with at most one line of copy, and every number is real (see docs/home.md
 * for sources). Tiles without data are hidden by the section, never faked.
 */

/** The tile shell: large radius, no icon-in-a-circle, a small heading and the live stamp. */
export function Tile({
  title,
  line,
  stamp,
  className,
  children,
}: {
  title: string;
  /** At most one short line of copy. */
  line?: ReactNode;
  stamp?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-5 rounded-[2rem] border bg-background/70 p-6 sm:p-8",
        className,
      )}
    >
      <header className="space-y-2">
        {stamp}
        <h3 className="text-xl leading-tight font-semibold tracking-tight">{title}</h3>
      </header>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
      {line && <p className="text-sm leading-6 text-muted-foreground">{line}</p>}
    </article>
  );
}

/** Counts up to the first value once (straight to it under reduced motion); later values show as they are. */
function useCountUp(target: number | null, duration = 1.1) {
  const reduce = usePrefersReducedMotion();
  const [first, setFirst] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  if (first === null && target !== null) setFirst(target);
  useEffect(() => {
    if (first === null || reduce) return;
    const controls = animate(0, first, {
      duration,
      ease: "easeOut",
      onUpdate: setShown,
      onComplete: () => setDone(true),
    });
    return () => controls.stop();
  }, [first, reduce, duration]);
  if (target === null) return null;
  return reduce || done ? target : shown;
}

const SIZE = 240;
const C = SIZE / 2;
/** A point on the dial: 0 minutes at the top, clockwise through 24 hours. */
const at = (minute: number, r: number) => {
  const a = (minute / 1440) * 2 * Math.PI - Math.PI / 2;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};
const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
};
const clockTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/**
 * LARGE: a 24-hour dial in New York time. The shaded arc is the regular US
 * session, the hand is now, and the outer ring is when most listed tokens
 * trade (around the clock on weekdays).
 */
export function HoursDial() {
  const now = useNow();
  const { overview } = useHomeMarket();
  const hours = overview?.totals.hours ?? null;
  const tokens = overview?.totals.tokens ?? null;
  if (now === 0) {
    return (
      <Tile title="Open when Wall Street isn't">
        <Skeleton className="mx-auto size-56 rounded-full" />
      </Tile>
    );
  }
  const clock = usMarketClock(new Date(now));
  const open = clock.session.open;
  const [x1, y1] = at(clock.openMinute, 84);
  const [x2, y2] = at(clock.closeMinute, 84);
  const state = open ? "US markets open" : "US markets closed";
  const next = `${open ? "Close" : "Open"} in ${duration(clock.minutesToChange)}`;
  const label = `24-hour clock in New York time. The regular US session runs 09:30 to 16:00. It is ${clockTime(clock.minuteOfDay)}. ${state}. ${next}.`;

  return (
    <Tile
      title="Open when Wall Street isn't"
      stamp={<LiveStamp at={now} failed={false} />}
      line={
        hours && tokens
          ? `${hours["24/5"] ?? 0} of ${tokens} listed tokens trade 24 hours a day, 5 days a week.`
          : undefined
      }
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10 lg:gap-14">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-56 shrink-0 sm:size-64 lg:size-80"
          role="img"
          aria-label={label}
        >
          {/* Outer ring: tokens trade around the clock on weekdays. */}
          <circle
            cx={C}
            cy={C}
            r="108"
            fill="none"
            stroke={clock.weekday ? "var(--gain)" : "var(--border)"}
            strokeWidth="3"
            strokeDasharray={clock.weekday ? undefined : "2 6"}
          />
          <circle cx={C} cy={C} r="84" fill="none" stroke="var(--border)" strokeWidth="10" />
          {/* The regular session, 09:30 to 16:00. */}
          <path
            d={`M${x1} ${y1} A84 84 0 0 1 ${x2} ${y2}`}
            fill="none"
            stroke={open ? "#8FA4FF" : "#3B5BDB"}
            strokeWidth="10"
            strokeLinecap="round"
          />
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = at(h * 60, 62);
            return (
              <text
                key={h}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {String(h).padStart(2, "0")}
              </text>
            );
          })}
          {/* The hand: now, in New York. */}
          <g
            style={{
              transform: `rotate(${(clock.minuteOfDay / 1440) * 360}deg)`,
              transformOrigin: `${C}px ${C}px`,
            }}
            className="transition-transform duration-700 ease-out"
          >
            <line
              x1={C}
              y1={C}
              x2={C}
              y2={C - 96}
              stroke="var(--foreground)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx={C} cy={C - 96} r="4" fill="var(--foreground)" />
          </g>
          <circle cx={C} cy={C} r="5" fill="var(--foreground)" />
        </svg>
        <div className="space-y-3 text-center sm:text-left" aria-live="polite">
          <p className="font-heading text-6xl leading-none font-semibold tracking-tight sm:text-7xl lg:text-8xl">
            24/5
          </p>
          <p className="font-mono text-sm tabular-nums">
            <span className={open ? "text-gain" : "text-foreground"}>{state}</span>
            <span className="block text-muted-foreground">{next}</span>
          </p>
          <ul className="space-y-1 font-mono text-xs text-muted-foreground">
            <li className="flex items-center justify-center gap-2 sm:justify-start">
              <span aria-hidden className="h-1.5 w-4 rounded-full bg-[#3B5BDB]" /> NYSE / Nasdaq,
              09:30–16:00 ET
            </li>
            <li className="flex items-center justify-center gap-2 sm:justify-start">
              <span aria-hidden className="h-0.5 w-4 rounded-full bg-gain" /> Tokens, Mon–Fri around
              the clock
            </li>
            <li>Now {clockTime(clock.minuteOfDay)} in New York</li>
          </ul>
        </div>
      </div>
    </Tile>
  );
}

const SLIDER_TICKERS = ["NVDA", "TSLA", "AAPL"];

/** MEDIUM: pick an amount; see what it buys of three real stocks right now, as a fraction of one share. */
export function FractionSlider() {
  const id = useId();
  const { overview, failed, stocks } = useHomeMarket();
  const [usd, setUsd] = useState(25);
  useWatch("fraction", SLIDER_TICKERS);
  const rows = SLIDER_TICKERS.flatMap((t) => stocks.find((s) => s.ticker === t) ?? []);

  return (
    <Tile
      title={`Start with $${MIN_ORDER_USD}, not a full share`}
      stamp={<LiveStamp />}
      line={`Orders start at $${MIN_ORDER_USD}, Jupiter's practical minimum.`}
    >
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <p className="font-heading text-6xl leading-none font-semibold tracking-tight tabular-nums">
            ${usd}
          </p>
          <label htmlFor={id} className="text-xs text-muted-foreground">
            Drag to change the amount
          </label>
        </div>
        <input
          id={id}
          type="range"
          min={MIN_ORDER_USD}
          max={500}
          step={5}
          value={usd}
          onChange={(e) => setUsd(Number(e.target.value))}
          aria-valuetext={`${usd} US dollars`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-raised accent-[#8FA4FF] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <ul className="space-y-2.5" aria-live="polite">
          {failed ? (
            <li className="text-sm text-muted-foreground">Data unavailable</li>
          ) : !overview ? (
            [0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-8 w-full" />
              </li>
            ))
          ) : (
            rows.map((r) => {
              const shares = r.price ? usd / r.price : null;
              return (
                <li key={r.ticker} className="space-y-1">
                  <p className="flex items-baseline justify-between gap-3 font-mono text-sm tabular-nums">
                    <span className="font-semibold">
                      {shares === null
                        ? "—"
                        : shares.toLocaleString("en-US", { maximumSignificantDigits: 3 })}{" "}
                      {r.chartSymbol}
                    </span>
                    {shares !== null && r.price !== null && (
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        {Math.min(100, shares * 100).toFixed(shares < 0.1 ? 1 : 0)}% of a{" "}
                        {formatPrice(r.price)} share
                      </span>
                    )}
                  </p>
                  <span
                    aria-hidden
                    className="block h-1.5 overflow-hidden rounded-full bg-surface-raised"
                  >
                    <span
                      style={{ transform: `scaleX(${shares === null ? 0 : Math.min(1, shares)})` }}
                      className="block h-full origin-left rounded-full bg-[linear-gradient(90deg,#3B5BDB,#8FA4FF)] transition-transform duration-300 ease-out"
                    />
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Tile>
  );
}

/** How wide the gauge is on each side of zero, in percent. */
const GAP_RANGE = 2;

/** MEDIUM: each token's price against the real stock's last price, as a bar either side of 0%. */
export function GapGauge({
  gaps,
  asOf,
}: {
  gaps: NonNullable<InvestorExtras["gaps"]>;
  asOf: string;
}) {
  return (
    <Tile
      title="See the gap before you buy"
      stamp={<LiveStamp at={Date.parse(asOf)} failed={false} />}
      line="Token price against the stock's last US price. Gaps widen when the market is closed."
    >
      <ul className="space-y-3" aria-live="polite">
        {gaps.map((g) => {
          const premium = g.gapPct >= 0;
          const size = Math.min(1, Math.abs(g.gapPct) / GAP_RANGE);
          return (
            <li key={g.ticker} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3">
              <span className="font-mono text-sm font-medium">{g.ticker}</span>
              <span
                role="img"
                aria-label={`${g.symbol} trades ${Math.abs(g.gapPct).toFixed(2)}% ${premium ? "above" : "below"} the stock`}
                className="relative block h-2 rounded-full bg-surface-raised"
              >
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
                <span
                  aria-hidden
                  style={{ transform: `scaleX(${size})` }}
                  className={cn(
                    "absolute inset-y-0 w-1/2 rounded-full transition-transform duration-500 ease-out",
                    premium ? "left-1/2 origin-left bg-gain" : "right-1/2 origin-right bg-loss",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-right font-mono text-sm tabular-nums",
                  premium ? "text-gain" : "text-loss",
                )}
              >
                {premium ? "+" : "−"}
                {Math.abs(g.gapPct).toFixed(2)}%
              </span>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}

/** SMALL: Solana's live throughput: a counter that counts up once, and the last 20 samples. */
export function NetworkTile({ stats, failed }: { stats: NetworkStats | null; failed: boolean }) {
  const shown = useCountUp(stats?.latest ?? null);
  return (
    <Tile
      title="Settles in seconds"
      stamp={<LiveStamp at={stats ? Date.parse(stats.asOf) : null} failed={failed && !stats} />}
      line="Transactions Solana is processing each second, right now."
    >
      {failed && !stats ? (
        <p className="text-sm text-muted-foreground">Data unavailable</p>
      ) : !stats ? (
        <Skeleton className="h-16 w-40" />
      ) : (
        <div className="space-y-4">
          <p
            className="font-heading text-6xl leading-none font-semibold tracking-tight tabular-nums"
            aria-live="polite"
          >
            {Math.round(shown ?? stats.latest).toLocaleString("en-US")}
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">TPS</span>
          </p>
          <span
            className="block"
            role="img"
            aria-label={`Between ${Math.min(...stats.tps).toLocaleString("en-US")} and ${Math.max(...stats.tps).toLocaleString("en-US")} transactions per second over the last ${stats.tps.length} minutes`}
          >
            <Sparkline
              points={stats.tps.map((value, time) => ({ time, value }))}
              className="h-14 w-full text-[#8FA4FF]"
            />
          </span>
        </div>
      )}
    </Tile>
  );
}

/** SMALL: enter Australian dollars; see the USDC and how much of one stock that buys. */
export function CurrencyTile({ audUsd, asOf }: { audUsd: number; asOf: string }) {
  const id = useId();
  const { stocks } = useHomeMarket();
  const [text, setText] = useState("100");
  const aud = Number(text) > 0 ? Number(text) : 0;
  const usdc = aud * audUsd;
  const stock = stocks.find((s) => s.ticker === "NVDA");
  return (
    <Tile
      title="Your money, your currency"
      stamp={<LiveStamp at={Date.parse(asOf)} failed={false} />}
      line={`1 AUD = ${audUsd.toFixed(4)} USD. USDC is a US-dollar stablecoin.`}
    >
      <div className="space-y-3">
        <label
          htmlFor={id}
          className="flex items-center gap-3 rounded-2xl border border-input bg-background px-4 focus-within:border-[var(--label-blue)]"
        >
          <span className="text-sm text-muted-foreground">AUD</span>
          <input
            id={id}
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
            aria-label="Amount in Australian dollars"
            className="h-12 min-w-0 flex-1 bg-transparent text-right font-mono text-lg tabular-nums outline-none"
          />
        </label>
        <p
          className="font-heading text-5xl leading-none font-semibold tracking-tight tabular-nums"
          aria-live="polite"
        >
          {usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">USDC</span>
        </p>
        {stock?.price ? (
          <p className="font-mono text-sm text-muted-foreground tabular-nums">
            ≈ {(usdc / stock.price).toLocaleString("en-US", { maximumSignificantDigits: 3 })}{" "}
            {stock.chartSymbol}
          </p>
        ) : null}
      </div>
    </Tile>
  );
}
