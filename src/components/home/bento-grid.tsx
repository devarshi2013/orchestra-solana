import { Reveal } from "@/components/motion";

import { Accent } from "@/components/design/text";
import { InvestorBento } from "./investors/investor-bento";

/**
 * "Built for investors who think first": a tinted band holding a bento of live
 * tiles (trading hours, fractions, throughput, and, when a fundamentals source
 * is configured, the token-to-stock gap and an AUD converter).
 */
export function BentoGrid() {
  return (
    <section
      id="product"
      aria-labelledby="bento-heading"
      className="relative scroll-mt-20 section-y"
    >
      {/* The band: a soft blue tint that fades into the page above and below. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--glow-blue)_9%,transparent)_18%,color-mix(in_srgb,var(--glow-blue)_9%,transparent)_82%,transparent)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2
            id="bento-heading"
            className="mx-auto max-w-2xl text-center text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl"
          >
            Built for investors who <Accent>think first</Accent>
          </h2>
        </Reveal>
        <InvestorBento />
      </div>
    </section>
  );
}
