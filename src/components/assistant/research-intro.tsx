"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, MessageCircleQuestion, PenLine, Zap } from "lucide-react";

import { Fragment } from "react";

import { Accent } from "@/components/design/text";

const HEADLINE = ["Research", "it.", "Quote", "it.", "Own", "it."];
/** The word that carries the gradient sweep. */
const KEY_WORD = "Quote";

const STEPS = [
  { label: "Ask", icon: MessageCircleQuestion },
  { label: "Live quote", icon: Zap },
  { label: "You approve", icon: PenLine },
];

/** Example questions on the empty screen: clicking one sends it. */
export const EXAMPLES = [
  "Top 3 tech stocks, $10 each",
  "Compare Apple and Microsoft",
  "Best healthcare ETFs",
  "Is Tesla overvalued?",
];

/**
 * What an empty chat shows: the headline (its words fade up one by one, and
 * "Quote" carries the home page's gradient sweep), one line on what Quill
 * does, the three steps, and example questions that send on click. It fades
 * away when the first message is sent. Under reduced motion nothing moves.
 */
export function ResearchIntro({
  onAsk,
  disabled,
}: {
  onAsk: (question: string) => void;
  disabled: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="space-y-7 text-center">
      <h2 className="text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl">
        {HEADLINE.map((word, i) => (
          <Fragment key={i}>
            <motion.span
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
            >
              {word === KEY_WORD ? <Accent>{word}</Accent> : word}
            </motion.span>
            {/* The space sits outside the inline-block, where it isn't collapsed. */}
            {i < HEADLINE.length - 1 && " "}
          </Fragment>
        ))}
      </h2>
      <p className="mx-auto max-w-xl text-base leading-7 text-muted-foreground">
        Ask about any stock. Quill pulls live data, gets a real Jupiter quote, and you approve the
        trade in your own wallet.
      </p>
      <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 font-mono text-xs text-muted-foreground">
        {STEPS.map((step, i) => (
          <li key={step.label} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
              {/* Each icon bobs a little, one after the other. */}
              <step.icon
                aria-hidden
                style={{ animationDelay: `${-i * 2.3}s` }}
                className="size-3.5 text-label-blue motion-safe:animate-float"
              />
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {EXAMPLES.map((question, i) => (
          <motion.li
            key={question}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.35 + i * 0.06 }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAsk(question)}
              className="rounded-full border border-label-blue/30 bg-card/70 px-4 py-2 text-sm text-foreground/90 transition-[background-color,border-color,color,translate] duration-200 ease-out outline-none hover:border-label-blue/60 hover:bg-glow-blue/15 hover:text-white focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-safe:hover:-translate-y-0.5"
            >
              {question}
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
