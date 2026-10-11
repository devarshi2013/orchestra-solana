import type { Metadata } from "next";

import { GridOverlay, Orbs } from "@/components/design/effects";
import { Accent, PauseOffscreen } from "@/components/design/text";
import { Screener } from "@/components/markets/screener";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "Markets",
  description: "Every tokenized stock you can buy on Solana, with live prices.",
};

/**
 * /markets: live prices for every tokenized US stock Quill lists, sortable,
 * with a page per stock. Dressed like the home page: the same orbs and dot
 * grid behind the heading, the same heading and accent fonts, cards and spacing.
 */
export default function MarketsPage() {
  return (
    <main className="relative isolate w-full flex-1 overflow-x-clip">
      <PauseOffscreen className="pointer-events-none absolute inset-x-0 top-0 h-[36rem]">
        <Orbs />
      </PauseOffscreen>
      <GridOverlay className="h-[36rem] [mask-image:radial-gradient(ellipse_at_top,#000_10%,transparent_65%)]" />
      <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-[var(--section-gap)] sm:px-6 sm:pt-20">
        <Reveal>
          <header>
            <h1 className="text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl">
              Markets, <Accent>live</Accent>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Every tokenized stock you can buy on Solana, live
            </p>
          </header>
        </Reveal>
        <div className="section-head">
          <Screener />
        </div>
      </div>
    </main>
  );
}
