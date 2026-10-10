"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { GridOverlay, HomeGradients, Orbs } from "./effects";

const STEPS = ["Search", "Research", "Approve", "Trade"];
const STEP_MS = 2200;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Pill label, two-line headline ("Quill" in a silver-to-blue gradient italic),
 * subtext, a word that slides vertically through Search → Research → Approve →
 * Trade, two buttons, and a large glowing ring-and-feather graphic below.
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
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden">
      <Orbs />
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
          Think before you trade.
          <span className="block">
            <em className="text-gradient-silver pr-[0.06em] font-semibold italic">Quill</em> does
            the research.
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
          className="mt-8 flex items-center justify-center gap-3 font-mono text-sm"
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
            <Link href="/chat">
              Launch Quill
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </motion.div>
      </div>

      {/* The hero graphic, below the text: glowing rings with a feather curve sweeping through. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
        className="relative mx-auto mt-6 w-full max-w-5xl px-4 sm:mt-2"
      >
        <RingsAndFeather />
      </motion.div>
    </section>
  );
}

/** Feather barbs: short strokes off one side of the curve, generated along a cubic Bézier. */
function barbs() {
  const p0 = [210, 400] as const;
  const p1 = [330, 310] as const;
  const p2 = [480, 210] as const;
  const p3 = [640, 130] as const;
  const at = (t: number, i: 0 | 1) =>
    (1 - t) ** 3 * p0[i] +
    3 * (1 - t) ** 2 * t * p1[i] +
    3 * (1 - t) * t ** 2 * p2[i] +
    t ** 3 * p3[i];
  const lines: string[] = [];
  for (let k = 0; k <= 26; k++) {
    const t = 0.12 + (k / 26) * 0.8;
    const len = 46 * Math.sin(Math.PI * ((t - 0.12) / 0.8)) + 8;
    lines.push(
      `M${at(t, 0).toFixed(1)} ${at(t, 1).toFixed(1)} l${(-len * 0.35).toFixed(1)} ${(-len).toFixed(1)}`,
    );
  }
  return lines.join(" ");
}
const BARBS = barbs();

function RingsAndFeather() {
  return (
    <svg aria-hidden viewBox="0 0 800 460" className="h-auto w-full">
      <HomeGradients id="hero" />
      <ellipse cx="400" cy="270" rx="300" ry="190" fill="url(#hero-glow)" />
      {/* The rings turn very slowly around the centre. */}
      <g className="origin-[400px_270px] motion-safe:animate-spin-slow">
        {[70, 120, 170, 220].map((r, i) => (
          <circle
            key={r}
            cx="400"
            cy="270"
            r={r}
            fill="none"
            stroke="url(#hero-silver)"
            strokeOpacity={0.55 - i * 0.1}
            strokeWidth={i === 1 ? 1.5 : 1}
            strokeDasharray={i === 2 ? "2 7" : undefined}
          />
        ))}
        <circle cx="400" cy="50" r="5" fill="#C9D0D7" />
        <circle cx="570" cy="270" r="4" fill="#8FA4FF" />
        <circle cx="281" cy="380" r="3.5" fill="#C9D0D7" fillOpacity="0.7" />
      </g>
      {/* The feather: a sweeping shaft with barbs, over a soft glow (the glow is skipped on phones). */}
      <g className="hidden sm:block" opacity="0.5" filter="blur(10px)">
        <path
          d="M210 400 C 330 310, 480 210, 640 130"
          stroke="#3B5BDB"
          strokeWidth="10"
          fill="none"
        />
      </g>
      <path
        d={BARBS}
        stroke="url(#hero-silver)"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M190 416 C 330 310, 480 210, 640 130"
        stroke="url(#hero-silver)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="400" cy="270" r="9" fill="#F5F7FA" />
      <circle cx="400" cy="270" r="22" fill="none" stroke="#8FA4FF" strokeOpacity="0.5" />
    </svg>
  );
}
