import type { ReactNode } from "react";

import { Reveal } from "@/components/motion";
import { cn } from "@/lib/utils";

import { ApproveVisual, ResearchVisual, SearchVisual } from "./feature-visuals";

const ROWS: { name: string; tagline: string; text: string; visual: ReactNode }[] = [
  {
    name: "Quill Research™",
    tagline: "Answers before you spend",
    text: "Get clear, data-backed answers about tokenized US stocks before you spend a cent.",
    visual: <ResearchVisual />,
  },
  {
    name: "Quill Search™",
    tagline: "Everything in one place",
    text: "Find any tokenized US stock in seconds and see everything that matters in one place.",
    visual: <SearchVisual />,
  },
  {
    name: "Quill Approve™",
    tagline: "Nothing moves without you",
    text: "Every trade waits for your signature. Your wallet, your keys, your call.",
    visual: <ApproveVisual />,
  },
];

/** A title + text and a visual per product, swapping sides each row ("How it works"). */
export function FeatureRows() {
  return (
    <section id="how-it-works" aria-label="How it works" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="space-y-20 sm:space-y-28">
          {ROWS.map((row, i) => (
            <div
              key={row.name}
              className="grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-24"
            >
              <Reveal
                delay={0.05}
                className={cn("space-y-3 md:max-w-md", i % 2 === 1 && "md:order-2 md:ml-auto")}
              >
                <h3 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                  {row.name}
                  <span className="block font-normal text-muted-foreground">{row.tagline}</span>
                </h3>
                <p className="text-base leading-7 text-muted-foreground">{row.text}</p>
              </Reveal>
              <Reveal
                delay={0.12}
                className={cn(
                  "mx-auto w-full max-w-md rounded-3xl border bg-card p-6 sm:p-10",
                  i % 2 === 1 && "md:order-1",
                )}
              >
                {row.visual}
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
