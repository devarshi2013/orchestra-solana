"use client";

import { ArrowRight, Check } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/hooks/use-markets";
import type { ExampleQuote } from "@/lib/markets/types";
import { describePriceImpact } from "@/lib/swap/quote";
import { cn } from "@/lib/utils";

import { LiveStamp } from "../live/home-market";
import { VisualFrame } from "./visual-frame";

const REFRESH_MS = 30_000;
const STEP_MS = 1600;
const STEPS = ["Quote", "Sign in wallet", "Confirmed"];
const LEVELS = ["low", "medium", "high"] as const;

/**
 * Trade card: a REAL Jupiter /order quote (10 USDC of a liquid stock, no
 * taker, so nothing can be signed) with its rate, price impact, fee and the
 * route the quote itself returned; a low / medium / high impact meter; and a
 * looping strip that demonstrates the flow (clearly labelled a demo). The
 * quote refreshes every 30 s, moving to the next of three stocks, with a
 * countdown ring. Refreshing pauses while the card is off screen or the tab is hidden.
 */
export function TradeVisual() {
  return (
    <VisualFrame label="Example: a live Jupiter quote and how approving a trade works">
      {(state) => <Trade {...state} />}
    </VisualFrame>
  );
}

function Trade({ active, reduce }: { active: boolean; reduce: boolean }) {
  const [quote, setQuote] = useState<ExampleQuote | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  const [step, setStep] = useState(0);

  // A quote straight away, then a new one each round.
  useEffect(() => {
    const abort = new AbortController();
    getJson<ExampleQuote>(`/api/markets/example-quote?i=${round}`, abort.signal)
      .then((q) => {
        setQuote(q);
        setFailed(false);
      })
      .catch((e: unknown) => {
        if (abort.signal.aborted) return;
        console.error("[home] trade quote failed", e);
        setFailed(true);
      });
    return () => abort.abort();
  }, [round]);

  // The next round starts 30 s later, only while the card is on screen and the tab is visible.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setRound((n) => n + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [active]);

  // The demo strip steps along while on screen; under reduced motion it rests on the last step.
  useEffect(() => {
    if (!active || reduce) return;
    const id = window.setInterval(() => setStep((n) => (n + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [active, reduce]);
  const current = reduce ? STEPS.length - 1 : step;

  const impact = quote ? describePriceImpact(quote.priceImpactPct) : null;
  const rate = quote && quote.tokensOut > 0 ? quote.usdcIn / quote.tokensOut : null;
  const hops = quote?.route ?? [];
  const routeText = quote
    ? `Route: USDC${hops.length ? ` through ${hops.map((h) => `${h.label} ${Math.round(h.percent)}%`).join(", ")}` : ` via ${quote.router}`} to ${quote.symbol}`
    : "";

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0" aria-live="polite">
          {failed && !quote ? (
            <p className="text-sm text-muted-foreground">Data unavailable</p>
          ) : !quote ? (
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-sm tabular-nums sm:text-base">
                {quote.usdcIn} USDC
                <ArrowRight className="size-3.5 text-muted-foreground" aria-label="buys" />
                <span className="font-semibold">
                  {quote.tokensOut.toLocaleString("en-US", { maximumSignificantDigits: 4 })}{" "}
                  {quote.symbol}
                </span>
              </p>
              <p className="mt-0.5 font-mono text-[0.625rem] text-muted-foreground tabular-nums">
                {rate !== null && `1 ${quote.symbol} ≈ $${rate.toFixed(2)}`}
                {quote.feeBps !== null && ` · fee ${(quote.feeBps / 100).toFixed(2)}%`}
              </p>
            </>
          )}
        </div>
        {/* Counts down to the next refresh; restarts with each new quote. */}
        <svg viewBox="0 0 20 20" className="size-5 shrink-0 -rotate-90" aria-hidden>
          <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="2" />
          {!reduce && quote && (
            <circle
              key={quote.asOf + round}
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="#8FA4FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="50.3"
              strokeDashoffset="0"
              className="animate-ring"
            />
          )}
        </svg>
      </div>

      {/* The route, only from what the quote returned. */}
      <div className="mt-2 flex flex-1 flex-col justify-center gap-2">
        <p className="sr-only">{routeText}</p>
        <div aria-hidden className="flex flex-wrap items-center gap-1 font-mono text-[0.625rem]">
          <Node strong>USDC</Node>
          {quote ? (
            (hops.length ? hops.slice(0, 3) : [{ label: quote.router, percent: 100 }]).map(
              (h, i) => (
                <Fragment key={`${h.label}-${i}`}>
                  <Line />
                  <Node>
                    {h.label}
                    {hops.length > 1 && (
                      <span className="text-muted-foreground"> {Math.round(h.percent)}%</span>
                    )}
                  </Node>
                </Fragment>
              ),
            )
          ) : (
            <>
              <Line />
              <Skeleton className="h-5 w-20 rounded-full" />
            </>
          )}
          <Line />
          <Node strong>{quote?.symbol ?? "…"}</Node>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] text-muted-foreground">Price impact</span>
          <span
            className="flex flex-1 gap-1"
            role="img"
            aria-label={
              impact ? `Price impact ${impact.text}, ${impact.severity}` : "Price impact loading"
            }
          >
            {LEVELS.map((level, i) => (
              <span
                key={level}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-300",
                  impact && LEVELS.indexOf(impact.severity) >= i
                    ? impact.severity === "low"
                      ? "bg-gain"
                      : impact.severity === "medium"
                        ? "bg-warning"
                        : "bg-loss"
                    : "bg-surface-raised",
                )}
              />
            ))}
          </span>
          <span className="w-20 text-right font-mono text-[0.625rem] tabular-nums">
            {impact ? `${impact.text} · ${impact.severity}` : "—"}
          </span>
        </div>
      </div>

      <div className="mt-2 rounded-lg border bg-background/60 px-2 py-1.5">
        <ol className="flex items-center gap-1 text-[0.625rem]">
          {STEPS.map((label, i) => (
            <Fragment key={label}>
              {i > 0 && <span aria-hidden className="h-px flex-1 bg-border" />}
              <li
                className={cn(
                  "flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors duration-300",
                  i === current ? "bg-surface-raised text-foreground" : "text-muted-foreground",
                )}
              >
                {i === STEPS.length - 1 && <Check className="size-3" aria-hidden />}
                {label}
              </li>
            </Fragment>
          ))}
        </ol>
        <p className="mt-1 flex items-center justify-between gap-2 text-[0.5625rem] text-muted-foreground">
          <span>Demo of the flow. No transaction is sent.</span>
          <LiveStamp
            at={quote ? Date.parse(quote.asOf) : null}
            failed={failed && !quote}
            className="text-[0.5625rem]"
          />
        </p>
      </div>
    </>
  );
}

function Node({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 whitespace-nowrap",
        strong
          ? "border-[rgb(143_164_255/0.5)] bg-[rgb(30_58_138/0.4)] text-foreground"
          : "bg-background/60",
      )}
    >
      {children}
    </span>
  );
}

function Line() {
  return <span className="h-px w-3 shrink-0 bg-[linear-gradient(90deg,#C9D0D7,#3B5BDB)]" />;
}
