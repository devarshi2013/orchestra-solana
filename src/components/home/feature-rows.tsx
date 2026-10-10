import type { ReactNode } from "react";

import { Reveal } from "@/components/motion";
import { cn } from "@/lib/utils";

import { GradientCard } from "./effects";
import { ResearchVisual } from "./feature-visuals/research-visual";
import { SearchVisual } from "./feature-visuals/search-visual";
import { TradeVisual } from "./feature-visuals/trade-visual";
import { SectionLabel } from "./hover-text";

const ROWS: { label: string; title: string; text: string; visual: ReactNode }[] = [
  {
    label: "Quill Research",
    title: "Ask anything. Get straight answers.",
    text: "Plain-language explanations of tokenized US stocks, built on live market data you can check.",
    visual: <ResearchVisual />,
  },
  {
    label: "Quill Search",
    title: "Find what matters, fast.",
    text: "Search any tokenized US stock and see the details that actually affect your decision.",
    visual: <SearchVisual />,
  },
  {
    label: "Quill Trade",
    title: "You approve. Quill executes.",
    text: "Once you sign in your wallet, Quill places the trade for you. No approval, no trade, ever.",
    visual: <TradeVisual />,
  },
];

/** Research, Search and Trade: a blue label, headline and text beside a gradient graphic, swapping sides. */
export function FeatureRows() {
  return (
    <section id="features" aria-label="Quill features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl space-y-24 px-4 pb-24 sm:space-y-32 sm:px-6 sm:pb-32">
        {ROWS.map((row, i) => (
          // Hovering a row turns its label silver (with an arrow) and underlines its headline.
          <div
            key={row.label}
            className="group/row grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-24"
          >
            <Reveal
              delay={0.05}
              className={cn("space-y-4 md:max-w-md", i % 2 === 1 && "md:order-2 md:ml-auto")}
            >
              <SectionLabel>{row.label}</SectionLabel>
              <h3 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                <span className="underline-grow">{row.title}</span>
              </h3>
              <p className="text-base leading-7 text-muted-foreground">{row.text}</p>
            </Reveal>
            <Reveal delay={0.12} className={cn("w-full", i % 2 === 1 && "md:order-1")}>
              <GradientCard innerClassName="p-6 sm:p-10">{row.visual}</GradientCard>
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}
