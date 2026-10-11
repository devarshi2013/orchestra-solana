import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";

import { PauseOffscreen } from "@/components/design/text";

/** The closing panel: navy-to-black gradient with a glowing orb in a corner, away from the text. */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="px-4 section-y sm:px-6">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-[rgb(255_255_255/0.06)] bg-[linear-gradient(135deg,var(--navy)_0%,#0A1220_45%,var(--page)_100%)] px-6 py-16 text-center sm:px-12 sm:py-24">
        <PauseOffscreen className="pointer-events-none absolute inset-0">
          <div
            aria-hidden
            className="absolute -top-32 -right-24 size-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--glow-blue)_45%,transparent),color-mix(in_srgb,var(--glow-deep)_0%,transparent)_70%)] blur-2xl will-change-transform motion-safe:animate-orb"
          />
        </PauseOffscreen>
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 hidden size-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--glow-deep)_40%,transparent),color-mix(in_srgb,var(--navy)_0%,transparent)_70%)] blur-2xl sm:block"
        />
        <h2
          id="cta-heading"
          className="relative mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-tight sm:text-5xl"
        >
          Search it. Approve it. Own it.
        </h2>
        <div className="relative section-head flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/markets">
              Start trading
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/chat">Research with Quill</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
