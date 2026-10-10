"use client";

import { motion, type Variants } from "framer-motion";
import { Search, ShieldCheck, Sparkles, Zap, type LucideIcon } from "lucide-react";

import { Reveal } from "@/components/motion";

const STEPS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Search", text: "Find any tokenized US stock in seconds.", icon: Search },
  {
    title: "Research",
    text: "Ask Quill anything and get straight answers from live data.",
    icon: Sparkles,
  },
  {
    title: "Approve",
    text: "Review the trade details and sign in your own wallet.",
    icon: ShieldCheck,
  },
  { title: "Trade", text: "Quill places the trade for you right after you approve.", icon: Zap },
];

const STEP_GAP = 0.35;
const list: Variants = { hidden: {}, shown: { transition: { staggerChildren: STEP_GAP } } };
// Each step starts dim and lights up in turn (only colour and opacity, so it
// still reads under reduced motion, where framer-motion skips movement).
const step: Variants = {
  hidden: { opacity: 0.35 },
  shown: { opacity: 1, transition: { duration: 0.5 } },
};
const circle: Variants = {
  hidden: {
    backgroundColor: "rgb(13 17 23)",
    borderColor: "rgb(255 255 255 / 0.12)",
    boxShadow: "0 0 0 0 rgb(59 91 219 / 0)",
  },
  shown: {
    backgroundColor: "rgb(30 58 138 / 0.55)",
    borderColor: "rgb(143 164 255 / 0.6)",
    boxShadow: "0 0 28px -2px rgb(59 91 219 / 0.75)",
    transition: { duration: 0.5 },
  },
};

/**
 * "How Quill works": Search → Research → Approve → Trade in a row (stacked on
 * phones), joined by a thin gradient line that fills as the steps light up
 * one by one when the section scrolls into view.
 */
export function HowQuillWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
        <Reveal>
          <h2
            id="how-heading"
            className="mx-auto max-w-3xl text-center text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl"
          >
            From question to trade,{" "}
            <em className="text-gradient-silver pr-[0.06em] font-semibold italic">
              you stay in control
            </em>
          </h2>
        </Reveal>

        <motion.ol
          variants={list}
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, amount: 0.4 }}
          className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6"
        >
          {/* The connecting line: across on desktop (through the circles), down the left on phones. */}
          <motion.span
            aria-hidden
            variants={{
              hidden: { scaleX: 0, scaleY: 0 },
              shown: {
                scaleX: 1,
                scaleY: 1,
                transition: { duration: STEP_GAP * STEPS.length, ease: "linear" },
              },
            }}
            className="absolute top-6 bottom-6 left-6 w-px origin-top bg-[linear-gradient(180deg,rgb(201_208_215/0.5),rgb(59_91_219/0.8),rgb(59_91_219/0.1))] md:top-6 md:right-[12.5%] md:bottom-auto md:left-[12.5%] md:h-px md:w-auto md:origin-left md:bg-[linear-gradient(90deg,rgb(201_208_215/0.5),rgb(59_91_219/0.8),rgb(59_91_219/0.1))]"
          />
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              variants={step}
              className="relative flex gap-5 md:flex-col md:items-center md:text-center"
            >
              <motion.span
                variants={circle}
                className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border"
              >
                <s.icon className="size-5 text-foreground" aria-hidden />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background font-mono text-[0.625rem] text-muted-foreground">
                  {i + 1}
                </span>
              </motion.span>
              <div className="space-y-1.5 pt-1 md:pt-3">
                <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="max-w-60 text-sm leading-6 text-muted-foreground">{s.text}</p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
