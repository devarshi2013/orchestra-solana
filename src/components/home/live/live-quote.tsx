"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Reveal } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/hooks/use-markets";
import type { ExampleQuote } from "@/lib/markets/types";

import { GradientCard } from "../effects";
import { LiveStamp } from "./home-market";

const REFRESH_MS = 30_000;

/**
 * An example question answered with a REAL Jupiter /order quote (10 USDC of
 * NVDA, no taker: pricing only, nothing that could be signed), refreshed
 * every 30 s while the tab is visible. Clearly labelled as a quote, not a trade.
 */
export function LiveQuote() {
  const [quote, setQuote] = useState<ExampleQuote | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    const load = () => {
      if (document.visibilityState !== "visible") return;
      getJson<ExampleQuote>("/api/markets/example-quote", abort.signal)
        .then((q) => {
          setQuote(q);
          setFailed(false);
        })
        .catch((e: unknown) => {
          if (abort.signal.aborted) return;
          console.error("[home] example quote failed", e);
          setFailed(true);
        });
    };
    load();
    const id = window.setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
      abort.abort();
    };
  }, []);

  return (
    <section aria-labelledby="live-quote-heading" className="px-4 pt-16 sm:px-6 sm:pt-20">
      <Reveal className="mx-auto max-w-3xl">
        <GradientCard innerClassName="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="live-quote-heading"
              className="font-mono text-xs font-medium tracking-[0.16em] text-[var(--label-blue)] uppercase"
            >
              Live quote, not a trade
            </h2>
            <LiveStamp at={quote ? Date.parse(quote.asOf) : null} failed={failed && !quote} />
          </div>
          <div className="mt-5 space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-surface-raised px-4 py-2.5 text-sm">
              What would 10 USDC of NVIDIA get me right now?
            </p>
            <div className="flex gap-3">
              <LogoMark className="mt-1 size-7" />
              <div className="min-h-16 flex-1 rounded-2xl rounded-tl-md border px-4 py-3">
                {failed && !quote ? (
                  <p className="text-sm text-muted-foreground">Data unavailable</p>
                ) : !quote ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-64 max-w-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ) : (
                  <>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-base tabular-nums sm:text-lg">
                      {quote.usdcIn} USDC
                      <ArrowRight className="size-4 text-muted-foreground" aria-label="buys" />
                      <span className="font-semibold">
                        {quote.tokensOut.toLocaleString("en-US", { maximumSignificantDigits: 4 })}{" "}
                        {quote.symbol}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {quote.priceImpactPct !== null &&
                        `price impact ${quote.priceImpactPct.toFixed(2)}%`}
                      {quote.priceImpactPct !== null && quote.feeBps !== null && " · "}
                      {quote.feeBps !== null && `Jupiter fee ${(quote.feeBps / 100).toFixed(2)}%`}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            A real quote from Jupiter for this amount, refreshed every 30 seconds. Nothing is
            bought.
          </p>
        </GradientCard>
      </Reveal>
    </section>
  );
}
