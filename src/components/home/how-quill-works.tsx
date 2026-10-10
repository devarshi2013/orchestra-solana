"use client";

import { motion, type Variants } from "framer-motion";
import { useState } from "react";
import { Search, ShieldCheck, Sparkles, Zap, type LucideIcon } from "lucide-react";

import { Reveal } from "@/components/motion";

import { Accent } from "./hover-text";

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
// Each step starts dim and lights up in turn. Only opacity and transform are
// animated: the lit look (glow, blue fill, bright ring) is a layer that fades in.
const step: Variants = {
  hidden: { opacity: 0.35 },
  shown: { opacity: 1, transition: { duration: 0.5 } },
};
const lit: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.5 } },
};

/**
 * "How Quill works": Search → Research → Approve → Trade in a row (stacked on
 * phones), joined by a thin gradient line that fills as the steps light up
 * one by one when the section scrolls into view. Hovering a step (mouse)
 * brightens its title, grows its circle a little and highlights the line up to it.
 */
export function HowQuillWorks() {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 pb-28 sm:px-6 sm:pb-40">
        <Reveal>
          <h2
            id="how-heading"
            className="mx-auto max-w-3xl text-center text-4xl leading-[1.06] font-semibold tracking-tight sm:text-5xl"
          >
            From question to trade, <Accent>you stay in control</Accent>
          </h2>
        </Reveal>

        <motion.ol
          variants={list}
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, amount: 0.4 }}
          onPointerLeave={() => setHovered(null)}
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
          {/* The hovered part of the line, from the first step to the hovered one (desktop). */}
          <span
            aria-hidden
            className="absolute top-6 right-[12.5%] left-[12.5%] hidden h-px origin-left bg-[linear-gradient(90deg,#C9D0D7,#8FA4FF)] shadow-[0_0_10px_rgb(143_164_255/0.8)] transition-[transform,opacity] duration-300 ease-out md:block"
            style={{
              transform: `scaleX(${hovered === null ? 0 : hovered / (STEPS.length - 1)})`,
              opacity: hovered === null || hovered === 0 ? 0 : 1,
            }}
          />
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              variants={step}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(i)}
              className="group/step relative flex gap-5 md:flex-col md:items-center md:text-center"
            >
              <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-[rgb(255_255_255/0.12)] bg-card transition-transform duration-300 ease-out motion-safe:group-hover/step:scale-110">
                <motion.span
                  aria-hidden
                  variants={lit}
                  className="absolute -inset-px rounded-full border border-[rgb(143_164_255/0.6)] bg-[rgb(30_58_138/0.55)] shadow-[0_0_28px_-2px_rgb(59_91_219/0.75)]"
                />
                <s.icon className="relative size-5 text-foreground" aria-hidden />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background font-mono text-[0.625rem] font-medium text-muted-foreground">
                  {i + 1}
                </span>
              </span>
              <div className="space-y-1.5 pt-1 md:pt-3">
                <h3 className="text-lg font-semibold tracking-tight transition-colors duration-300 ease-out group-hover/step:text-white">
                  {s.title}
                </h3>
                <p className="max-w-60 text-sm leading-6 text-muted-foreground">{s.text}</p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
