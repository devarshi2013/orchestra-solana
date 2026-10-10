"use client";

import { ArrowRight, Check, ExternalLink, Send, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { TokenLogo } from "@/components/market/token-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd } from "@/lib/market/series";
import { describePriceImpact } from "@/lib/swap/quote";
import { cn } from "@/lib/utils";

import { useTyping } from "../feature-visuals/visual-frame";
import { LiveStamp } from "../live/home-market";
import type { StoryData, StoryItem } from "./story-data";

/**
 * The five product screens the walkthrough's device frame shows, one per
 * step. Stocks, market caps, returns, quotes and prices are real; the wallet
 * pop-up and the success state are labelled demos and can't trigger a
 * transaction (their buttons aren't buttons). `instant` shows each screen's
 * final state with no typing or staggering (reduced motion).
 */

export const QUESTION = "Put $10 each into the top 3 tech stocks";
const REPLY =
  "Here are the three largest technology stocks by market cap right now. I'd put $10 into each.";

export type ScreenProps = { data: StoryData; instant: boolean };

/** What each screen shows, for screen readers. */
export function describeScreen(step: number, data: StoryData): string {
  const names = data.items?.map((i) => i.ticker).join(", ") ?? "three stocks";
  return [
    `Step 1, Ask. The chat box types: ${QUESTION}.`,
    `Step 2, Research. Quill replies with a ranked table of ${names}, with market cap and 1 year return, and the data it used.`,
    `Step 3, Quote. A plan card shows a live Jupiter quote for 10 USDC of each of ${names}: tokens out, price impact, fee and route.`,
    "Step 4, Approve. A wallet pop-up asks to approve the first swap, with Reject and Approve. This is a demo; no transaction is sent.",
    `Step 5, Own. Three checks confirm the buys, then a holdings card lists ${names} with their live value. This is a demo.`,
  ][step]!;
}

export function Screen({ step, ...props }: ScreenProps & { step: number }) {
  const Current = [AskScreen, ResearchScreen, QuoteScreen, ApproveScreen, OwnScreen][step]!;
  return <Current {...props} />;
}

const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
const amount = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 4 });

function Unavailable() {
  return <p className="py-6 text-center text-sm text-muted-foreground">Data unavailable</p>;
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <p className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-surface-raised px-3 py-1.5 text-xs">
      {children}
    </p>
  );
}

function Composer({ value, caret }: { value: string; caret: boolean }) {
  return (
    <div className="mt-auto flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
      <p className="min-h-5 flex-1 text-xs">
        {value || <span className="text-muted-foreground">Ask about tokenized stocks…</span>}
        {caret && (
          <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground align-middle" />
        )}
      </p>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Send className="size-3.5" />
      </span>
    </div>
  );
}

/** 1. Ask: the question types itself into the chat box. */
function AskScreen({ instant }: ScreenProps) {
  const typing = useTyping(QUESTION, true, instant, 45);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="m-auto text-center">
        <LogoMark className="mx-auto size-9" />
        <p className="mt-3 font-heading text-base font-semibold">How can I help today?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Research tokenized US stocks with live data.
        </p>
      </div>
      <Composer value={typing.value} caret={!typing.done} />
    </div>
  );
}

function RankedRows({ items, basis }: { items: StoryItem[]; basis: StoryData["basis"] }) {
  const max = Math.max(1, ...items.map((i) => i.marketCap));
  return (
    <ol className="space-y-1.5">
      {items.map((item, i) => (
        <li
          key={item.ticker}
          className="flex items-center gap-2 rounded-lg border bg-background/60 px-2 py-1.5"
        >
          <span className="w-3 font-mono text-[0.625rem] text-muted-foreground">{i + 1}</span>
          <TokenLogo src={item.icon} symbol={item.ticker} className="size-5" />
          <span className="w-11 shrink-0 font-mono text-xs font-medium">{item.ticker}</span>
          <span className="min-w-0 flex-1">
            <span className="sr-only">
              Market cap{basis === "on-chain" ? " (on-chain)" : ""}{" "}
              {formatCompactUsd(item.marketCap)}
            </span>
            <span
              aria-hidden
              className="block h-1.5 overflow-hidden rounded-full bg-surface-raised"
            >
              <span
                style={{ width: `${(item.marketCap / max) * 100}%` }}
                className="block h-full rounded-full bg-[linear-gradient(90deg,#3B5BDB,#8FA4FF)]"
              />
            </span>
            <span
              aria-hidden
              className="mt-0.5 block font-mono text-[0.625rem] text-muted-foreground tabular-nums"
            >
              {formatCompactUsd(item.marketCap)}
            </span>
          </span>
          <span
            className={cn(
              "w-12 shrink-0 text-right font-mono text-xs tabular-nums",
              item.return1y === null
                ? "text-muted-foreground"
                : item.return1y >= 0
                  ? "text-gain"
                  : "text-loss",
            )}
          >
            <span className="sr-only">1 year return </span>
            {item.return1y === null ? "—" : pct(item.return1y)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 2. Research: the reply streams in, then the data chips and the ranked table of real stocks. */
function ResearchScreen({ data, instant }: ScreenProps) {
  const reply = useTyping(REPLY, true, instant, 14);
  return (
    <div className="flex h-full flex-col gap-2.5">
      <UserBubble>{QUESTION}</UserBubble>
      <div className="flex gap-2">
        <LogoMark className="mt-0.5 size-5" />
        <p className="min-h-10 flex-1 text-xs leading-5">{reply.value}</p>
      </div>
      <div
        className={cn(
          "space-y-2 transition-opacity duration-500",
          reply.done ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="flex flex-wrap items-center gap-1.5 text-[0.625rem] text-muted-foreground">
          Data used
          {[
            `Market cap${data.basis === "on-chain" ? " (on-chain)" : ""}`,
            "1Y return",
            "Liquidity",
          ].map((chip) => (
            <span key={chip} className="rounded-full border px-2 py-0.5">
              {chip}
            </span>
          ))}
        </p>
        {data.failed ? (
          <Unavailable />
        ) : !data.items ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <RankedRows items={data.items} basis={data.basis} />
        )}
        <LiveStamp at={data.asOf} failed={data.failed} className="text-[0.625rem]" />
      </div>
    </div>
  );
}

function ImpactMeter({ impactPct }: { impactPct: number | null }) {
  const impact = describePriceImpact(impactPct);
  const level = ["low", "medium", "high"].indexOf(impact.severity);
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={`Price impact ${impact.text}, ${impact.severity}`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1 w-3 rounded-full",
            i <= level
              ? level === 0
                ? "bg-gain"
                : level === 1
                  ? "bg-warning"
                  : "bg-loss"
              : "bg-surface-raised",
          )}
        />
      ))}
      <span aria-hidden className="font-mono text-[0.5625rem] text-muted-foreground tabular-nums">
        {impact.text}
      </span>
    </span>
  );
}

function PlanCard({ data, dimmed = false }: { data: StoryData; dimmed?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/70 p-2.5 transition-opacity",
        dimmed && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">Proposed plan · $30</p>
        <LiveStamp at={latest(data)} failed={data.failed} className="text-[0.5625rem]" />
      </div>
      {data.failed ? (
        <Unavailable />
      ) : !data.items ? (
        <div className="mt-2 space-y-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.items.map((item) => {
            const q = item.quote;
            const hops = q?.route.length
              ? q.route.slice(0, 2)
              : q
                ? [{ label: q.router, percent: 100 }]
                : [];
            return (
              <li key={item.ticker} className="rounded-lg border px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <TokenLogo src={item.icon} symbol={item.ticker} className="size-4" />
                  {q === undefined ? (
                    <Skeleton className="h-4 flex-1" />
                  ) : q === null ? (
                    <span className="flex-1 text-xs text-muted-foreground">
                      {item.ticker}: Data unavailable
                    </span>
                  ) : (
                    <p className="flex flex-1 flex-wrap items-center gap-x-1 font-mono text-[0.6875rem] tabular-nums">
                      {q.usdcIn} USDC{" "}
                      <ArrowRight className="size-3 text-muted-foreground" aria-label="buys" />
                      <span className="font-semibold">
                        {amount(q.tokensOut)} {q.symbol}
                      </span>
                    </p>
                  )}
                </div>
                {q && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <ImpactMeter impactPct={q.priceImpactPct} />
                    {q.feeBps !== null && (
                      <span className="font-mono text-[0.5625rem] text-muted-foreground tabular-nums">
                        fee {(q.feeBps / 100).toFixed(2)}%
                      </span>
                    )}
                    <span className="sr-only">
                      Route: USDC through {hops.map((h) => h.label).join(", ")} to {q.symbol}
                    </span>
                    <span
                      aria-hidden
                      className="ml-auto flex items-center gap-0.5 font-mono text-[0.5625rem] text-muted-foreground"
                    >
                      USDC
                      {hops.map((h, i) => (
                        <span key={`${h.label}-${i}`} className="flex items-center gap-0.5">
                          <span className="h-px w-2 bg-[linear-gradient(90deg,#C9D0D7,#3B5BDB)]" />
                          <span className="max-w-16 truncate rounded-full border px-1">
                            {h.label}
                          </span>
                        </span>
                      ))}
                      <span className="h-px w-2 bg-[linear-gradient(90deg,#C9D0D7,#3B5BDB)]" />
                      {q.symbol}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The newest quote's time, for the plan card's stamp. */
function latest(data: StoryData): number | null {
  const times = (data.items ?? []).flatMap((i) => (i.quote ? [Date.parse(i.quote.asOf)] : []));
  return times.length ? Math.max(...times) : null;
}

/** 3. Quote: the plan card with a real Jupiter quote for each item. */
function QuoteScreen({ data }: ScreenProps) {
  return (
    <div className="flex h-full flex-col gap-2.5">
      <UserBubble>{QUESTION}</UserBubble>
      <PlanCard data={data} />
      <p className="mt-auto text-center text-[0.625rem] text-muted-foreground">
        Live Jupiter quotes. Nothing is bought.
      </p>
    </div>
  );
}

/** 4. Approve: a wallet pop-up over the plan (a demo: its buttons do nothing). */
function ApproveScreen({ data }: ScreenProps) {
  const first = data.items?.find((i) => i.quote)?.quote ?? null;
  return (
    <div className="relative flex h-full flex-col gap-2.5">
      <UserBubble>{QUESTION}</UserBubble>
      <PlanCard data={data} dimmed />
      <div className="absolute inset-x-2 bottom-2 rounded-2xl border bg-popover p-3.5 shadow-lift sm:inset-x-6">
        <p className="flex items-center justify-between gap-2 text-[0.625rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden /> Your wallet
          </span>
          <span className="rounded-full border px-1.5 py-0.5">Demo, no transaction is sent</span>
        </p>
        <p className="mt-2 text-sm font-semibold">Approve swap?</p>
        <div className="mt-0.5 min-h-5 font-mono text-xs tabular-nums">
          {data.failed ? (
            "Data unavailable"
          ) : first ? (
            `${first.usdcIn} USDC → ${amount(first.tokensOut)} ${first.symbol}`
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </div>
        {/* Not real buttons: this is a picture of the wallet step. */}
        <div aria-hidden className="mt-3 grid grid-cols-2 gap-2 text-center text-xs font-medium">
          <span className="rounded-lg border border-[rgb(255_255_255/0.24)] py-2">Reject</span>
          <span className="rounded-lg bg-primary py-2 text-primary-foreground motion-safe:animate-pulse">
            Approve
          </span>
        </div>
      </div>
    </div>
  );
}

/** 5. Own: three checks, one by one, then the holdings with their live value (a demo). */
function OwnScreen({ data, instant }: ScreenProps) {
  const items = data.items ?? [];
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="flex items-center justify-between gap-2 text-xs font-semibold">
        Bought
        <span className="rounded-full border px-1.5 py-0.5 text-[0.625rem] font-normal text-muted-foreground">
          Demo
        </span>
      </p>
      {data.failed ? (
        <Unavailable />
      ) : !data.items ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <>
          <ul className="flex gap-2">
            {items.map((item, i) => (
              <li
                key={item.ticker}
                style={{ animationDelay: instant ? undefined : `${i * 350}ms` }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 font-mono text-xs",
                  !instant && "animate-in duration-500 fade-in-0 fill-mode-both zoom-in-75",
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-gain text-background">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {item.ticker}
              </li>
            ))}
          </ul>
          <div
            style={{ animationDelay: instant ? undefined : "1200ms" }}
            className={cn(
              "rounded-xl border bg-background/70 p-2.5",
              !instant && "animate-in duration-500 fade-in-0 fill-mode-both slide-in-from-bottom-2",
            )}
          >
            <p className="flex items-center justify-between gap-2 text-xs font-semibold">
              Your holdings
              <LiveStamp className="text-[0.5625rem] font-normal" />
            </p>
            <ul className="mt-2 divide-y">
              {items.map((item) => {
                const q = item.quote;
                const value = q && item.price !== null ? q.tokensOut * item.price : null;
                return (
                  <li key={item.ticker} className="flex items-center gap-2 py-1.5">
                    <TokenLogo src={item.icon} symbol={item.ticker} className="size-5" />
                    <span className="flex-1 font-mono text-xs">
                      {q ? `${amount(q.tokensOut)} ${q.symbol}` : item.ticker}
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      {value === null ? "—" : `$${value.toFixed(2)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
      <p className="mt-auto flex items-center justify-center gap-1 text-[0.625rem] text-muted-foreground/70">
        <ExternalLink className="size-3" aria-hidden /> View on Solscan (demo, not a link)
      </p>
    </div>
  );
}
