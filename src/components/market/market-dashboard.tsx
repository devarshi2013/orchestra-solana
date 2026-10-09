"use client";

import { useRef, useState } from "react";

import { MarketProvider } from "@/hooks/use-market";
import { SOL_MINT } from "@/lib/tokens";

import { HeroChart } from "./hero-chart";
import { MarketGrid } from "./market-grid";

/** The home dashboard: the hero chart and the market grid, sharing one price poller. */
export function MarketDashboard() {
  const [mint, setMint] = useState(SOL_MINT);
  const hero = useRef<HTMLDivElement>(null);

  const select = (next: string) => {
    setMint(next);
    // On small screens the grid sits below the chart: bring the chart back into view.
    const top = hero.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) hero.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <MarketProvider>
      <div className="space-y-10">
        <div ref={hero} className="scroll-mt-20">
          <HeroChart mint={mint} onSelect={select} />
        </div>
        <MarketGrid selected={mint} onSelect={select} />
      </div>
    </MarketProvider>
  );
}
