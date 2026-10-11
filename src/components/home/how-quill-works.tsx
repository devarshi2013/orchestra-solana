import { Reveal } from "@/components/motion";

import { Accent } from "@/components/design/text";
import { ScrollStory } from "./story/scroll-story";

/**
 * "From question to trade": the heading, then a scroll-driven walkthrough of
 * one trade (src/components/home/story/). Real stocks, numbers and Jupiter
 * quotes; the wallet and success screens are labelled demos.
 */
export function HowQuillWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 section-y">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2
            id="how-heading"
            className="mx-auto max-w-3xl text-center text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl"
          >
            From question to trade, <Accent>you stay in control</Accent>
          </h2>
        </Reveal>
        <ScrollStory />
      </div>
    </section>
  );
}
