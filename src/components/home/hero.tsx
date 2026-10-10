"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DitherField } from "./dither-field";

const WORDS = ["research", "compare", "decide", "approve", "own"];
const WORD_MS = 2200;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Headline with an italic accent, a row of words that cycles (one highlighted
 * at a time, its underline sliding along), the call to action, and a large
 * framed field of drifting navy dots. Under reduced motion nothing cycles.
 */
export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % WORDS.length), WORD_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <section aria-labelledby="hero-heading" className="relative">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 md:pt-28">
        <motion.h1
          id="hero-heading"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto max-w-4xl text-[2.75rem] leading-[1.02] font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl"
        >
          AI research for{" "}
          <em className="font-normal tracking-tight italic">
            <span className="whitespace-nowrap">on-chain</span> investors
          </em>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
          className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
        >
          Research, compare, and buy tokenized US stocks, with every trade approved in your own
          wallet.
        </motion.p>

        {/* The rotating word row: the highlighted word moves along, with its underline sliding after it. */}
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 font-mono text-xs sm:gap-x-3 sm:text-[0.9375rem]"
          aria-label="Research, compare, decide, approve, own"
        >
          {WORDS.map((word, i) => (
            <li key={word} className="flex items-center gap-x-1.5 sm:gap-x-3" aria-hidden>
              {i > 0 && <span className="text-border">·</span>}
              <span
                className={cn(
                  "relative pb-1 transition-colors duration-500",
                  reduce || i === active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {word}
                {!reduce && i === active && (
                  <motion.span
                    layoutId="hero-word"
                    className="absolute inset-x-0 -bottom-0.5 h-px bg-primary"
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                )}
              </span>
            </li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.22 }}
          className="mt-10"
        >
          <Button asChild size="lg">
            <Link href="/chat">
              Launch Quill
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* The hero visual: a rounded frame of drifting dithered dots, with thin guide lines. */}
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
          className="relative aspect-[4/3] overflow-hidden rounded-3xl border bg-card sm:aspect-[16/9] md:aspect-[21/9]"
        >
          <DitherField speed="80s" />
          <DitherField speed="140s" flip className="opacity-20" />
          <svg
            aria-hidden
            className="absolute inset-0 size-full text-border"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <line
              x1="0"
              y1="100"
              x2="100"
              y2="0"
              stroke="currentColor"
              strokeWidth="0.15"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="33.3"
              y1="0"
              x2="33.3"
              y2="100"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="66.6"
              y1="0"
              x2="66.6"
              y2="100"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* A soft wash keeps the middle calm. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--card)_0%,transparent_60%)] opacity-80"
          />
        </motion.div>
      </div>
    </section>
  );
}
