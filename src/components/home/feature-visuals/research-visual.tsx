"use client";

import { useEffect, useState } from "react";

import { TokenLogo } from "@/components/market/token-logo";
import { Sparkline } from "@/components/markets/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson, useSparklines } from "@/hooks/use-markets";
import { formatCompactUsd } from "@/lib/market/series";
import type { ResearchTop } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

import { LiveStamp, useHomeMarket, useWatch } from "../live/home-market";
import { useTyping, VisualFrame } from "./visual-frame";

const QUESTION = "Top 3 tech by market cap?";
type Column = "cap" | "return" | "liquidity";
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

/**
 * Research card: the question types out once, then the three largest tech
 * stocks appear one by one, ranked by real market cap, each with a
 * proportional bar, 1Y return and a 30-day sparkline. "Data used" chips
 * highlight their column; hovering a row shows P/E and the 24h change.
 * Figures with no source (no fundamentals key) show "—", never a guess.
 */
export function ResearchVisual() {
  return (
    <VisualFrame label="Example: the three largest technology stocks, ranked with live data">
      {(state) => <Research {...state} />}
    </VisualFrame>
  );
}

function Research({ active, reduce }: { active: boolean; reduce: boolean }) {
  const { stocks } = useHomeMarket();
  const [data, setData] = useState<ResearchTop | null>(null);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(false);
  const [column, setColumn] = useState<Column | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    getJson<ResearchTop>("/api/markets/research-top", abort.signal)
      .then(setData)
      .catch((e: unknown) => {
        if (abort.signal.aborted) return;
        console.error("[home] research top failed", e);
        setFailed(true);
      });
    return () => abort.abort();
  }, []);

  // Start once, the first time the card is on screen.
  if (active && !seen) setSeen(true);
  const question = useTyping(QUESTION, seen, reduce);
  const tickers = (data?.rows ?? []).map((r) => r.ticker);
  useWatch("research", tickers);
  const sparklines = useSparklines(tickers, "30d");
  const max = Math.max(1, ...(data?.rows ?? []).map((r) => r.marketCap));
  const capLabel = data?.basis === "company" ? "Market cap" : "Market cap (on-chain)";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <LiveStamp
          at={data ? Date.parse(data.asOf) : null}
          failed={failed}
          className="text-[0.625rem]"
        />
        <p className="min-h-7 w-fit max-w-full rounded-2xl rounded-br-md bg-surface-raised px-3 py-1 text-xs">
          {question.value}
          {!question.done && (
            <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-foreground align-middle" />
          )}
          <span className="sr-only">{question.done ? "" : QUESTION}</span>
        </p>
      </div>

      <ol className="mt-2 flex flex-1 flex-col justify-center gap-1.5" aria-live="polite">
        {failed ? (
          <li className="text-center text-sm text-muted-foreground">Data unavailable</li>
        ) : !data ? (
          [0, 1, 2].map((i) => (
            <li key={i} className={cn(i === 2 && "max-lg:hidden")}>
              <Skeleton className="h-10 w-full rounded-lg" />
            </li>
          ))
        ) : (
          data.rows.map((r, i) => {
            const live = stocks.find((s) => s.ticker === r.ticker);
            const shown = reduce || question.done;
            return (
              <li
                key={r.ticker}
                tabIndex={0}
                onPointerEnter={() => setHovered(r.ticker)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(r.ticker)}
                onBlur={() => setHovered(null)}
                style={{ transitionDelay: reduce ? undefined : `${i * 160}ms` }}
                className={cn(
                  // Phones and tablets (smaller cards) show two rows.
                  i === 2 && "max-lg:hidden",
                  "relative flex items-center gap-2 rounded-lg border bg-background/60 px-2 py-1.5 transition-[opacity,transform] duration-500 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  shown ? "opacity-100" : "opacity-0 motion-safe:translate-y-1.5",
                )}
              >
                <span className="w-3 font-mono text-[0.625rem] text-muted-foreground">{i + 1}</span>
                <TokenLogo src={r.icon} symbol={r.ticker} className="size-5" />
                <span className="w-11 shrink-0">
                  <span className="block font-mono text-xs font-medium">{r.ticker}</span>
                  <span
                    className={cn(
                      "block font-mono text-[0.5625rem] tabular-nums transition-colors duration-200",
                      column === "liquidity" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {r.liquidity === null ? "—" : formatCompactUsd(r.liquidity)}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">
                    {capLabel} {formatCompactUsd(r.marketCap)}
                  </span>
                  <span
                    aria-hidden
                    className="block h-1.5 overflow-hidden rounded-full bg-surface-raised"
                  >
                    <span
                      style={{
                        transform: `scaleX(${shown ? r.marketCap / max : 0})`,
                        transitionDelay: reduce ? undefined : `${i * 160 + 150}ms`,
                      }}
                      className={cn(
                        "block h-full origin-left rounded-full bg-[linear-gradient(90deg,var(--glow-blue),var(--label-blue))] transition-transform duration-700 ease-out",
                        column === "cap" && "brightness-150",
                      )}
                    />
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 block font-mono text-[0.625rem] tabular-nums transition-colors duration-200",
                      column === "cap" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {formatCompactUsd(r.marketCap)}
                  </span>
                </span>
                <span
                  className={cn(
                    "w-12 shrink-0 rounded px-0.5 text-right font-mono text-xs tabular-nums transition-colors duration-200",
                    r.return1y === null
                      ? "text-muted-foreground"
                      : r.return1y >= 0
                        ? "text-gain"
                        : "text-loss",
                    column === "return" && "bg-surface-raised",
                  )}
                >
                  <span className="sr-only">1 year return </span>
                  {r.return1y === null ? "—" : pct(r.return1y)}
                </span>
                <Sparkline points={sparklines[r.ticker]} className="h-6 w-12 shrink-0" />
                {hovered === r.ticker && (
                  <span
                    role="tooltip"
                    className="absolute -top-7 right-2 z-10 rounded-md border bg-popover px-2 py-1 font-mono text-[0.625rem] whitespace-nowrap shadow-lift"
                  >
                    P/E {r.pe === null ? "—" : r.pe.toFixed(1)} · 24h{" "}
                    {live?.change24h == null ? "—" : pct(live.change24h)}
                  </span>
                )}
              </li>
            );
          })
        )}
      </ol>

      <div className="mt-2 flex items-center gap-1.5 overflow-hidden" aria-label="Data used">
        <span className="text-[0.625rem] text-muted-foreground max-lg:hidden">Data used</span>
        {(
          [
            ["cap", capLabel],
            ["return", "1Y return"],
            ["liquidity", "Liquidity"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onPointerEnter={() => setColumn(id)}
            onPointerLeave={() => setColumn(null)}
            onFocus={() => setColumn(id)}
            onBlur={() => setColumn(null)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[0.625rem] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              column === id
                ? "border-[var(--label-blue)] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
