"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { GridOverlay, Orbs } from "./effects";
import { HeroVisual } from "./hero-visual";
import { Accent, HoverWords, PauseOffscreen } from "./hover-text";

const STEPS = ["Search", "Research", "Approve", "Trade"];
const STEP_MS = 2200;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Pill label, two-line headline ("Quill" in a silver-to-blue gradient italic),
 * subtext, a word that slides vertically through Search → Research → Approve →
 * Trade, two buttons, and the live chart visual below (HeroVisual).
 * Orbs drift behind; under reduced motion nothing moves or cycles.
 */
export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setStep((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    // No overflow clipping here: the orbs spill into the next section (the page wrapper clips sideways).
    <section aria-labelledby="hero-heading" className="relative isolate">
      <PauseOffscreen className="pointer-events-none absolute inset-0 -bottom-40">
        <Orbs />
      </PauseOffscreen>
      <GridOverlay className="[mask-image:radial-gradient(ellipse_at_top,#000_10%,transparent_65%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
        >
          <span className="size-1.5 rounded-full bg-[var(--label-blue)]" aria-hidden />
          AI research · Your wallet · Your call
        </motion.p>

        <motion.h1
          id="hero-heading"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
          className="mx-auto mt-7 max-w-4xl text-[2.6rem] leading-[1.04] font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl"
        >
          <HoverWords text="Think before you trade." />
          <span className="block">
            <Accent className="hover-word">Quill</Accent> <HoverWords text="does the research." />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
        >
          Search any tokenized US stock, get clear research built on live data, and let Quill place
          the trade once you approve it in your wallet.
        </motion.p>

        {/* Rotating step: the word (and its number) slide up to the next one. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-8 flex items-center justify-center gap-3 font-mono text-sm font-medium"
        >
          <span className="sr-only">Search, then research, then approve, then trade.</span>
          <span aria-hidden className="text-muted-foreground tabular-nums">
            {String(step + 1).padStart(2, "0")} / 0{STEPS.length}
          </span>
          <span aria-hidden className="h-px w-8 bg-border" />
          <span
            aria-hidden
            className="relative inline-flex h-6 w-28 items-center overflow-hidden text-left text-foreground"
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={STEPS[step]}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="absolute inset-x-0"
              >
                {STEPS[step]} →
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.24 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/markets">
              Start trading
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/chat">Research with Quill</Link>
          </Button>
        </motion.div>
      </div>

      {/* The hero visual, below the text: a live chart with a question and a real quote floating over it. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
        className="relative mx-auto mt-10 w-full max-w-5xl px-4 sm:mt-14 sm:px-6"
      >
        <HeroVisual />
      </motion.div>
    </section>
  );
}
