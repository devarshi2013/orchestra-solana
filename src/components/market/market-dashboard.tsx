"use client";

import { useRef, useState } from "react";

import { MarketProvider } from "@/hooks/use-market";
import { MARKET_TOKENS } from "@/lib/market/config";

import { HeroChart } from "./hero-chart";
import { MarketGrid } from "./market-grid";

/**
 * The home dashboard: the market list on top and, below it, the chart for the
 * market picked there (the first one by default). One price poller feeds both.
 */
export function MarketDashboard() {
  const [mint, setMint] = useState(MARKET_TOKENS[0]!.mint);
  const chart = useRef<HTMLDivElement>(null);

  const select = (next: string) => {
    setMint(next);
    // Keep the chart in view: scroll to it when its top is off screen or, on
    // phones, low enough that the chart itself is below the fold. Smooth unless
    // the visitor asks for less motion.
    const el = chart.current;
    if (!el) return;
    const { top } = el.getBoundingClientRect();
    const phone = window.matchMedia("(max-width: 639px)").matches;
    if (top < 64 || top > window.innerHeight * (phone ? 0.3 : 0.6)) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  return (
    <MarketProvider>
      <div className="space-y-6">
        <MarketGrid selected={mint} onSelect={select} />
        <div ref={chart} className="scroll-mt-20">
          <HeroChart mint={mint} />
        </div>
      </div>
    </MarketProvider>
  );
}
