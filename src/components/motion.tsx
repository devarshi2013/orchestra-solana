"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Transition,
} from "framer-motion";
import { Loader2, PenLine, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { BuyStep } from "@/hooks/use-plan-buy";
import { cn } from "@/lib/utils";

/**
 * Motion for the whole app: subtle, quick, and switched off for anyone who
 * asks their OS for reduced motion (framer-motion then skips transforms and
 * keeps only opacity changes).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** The card spring: quick and critically damped, so layout never overshoots. */
const SPRING: Transition = { type: "spring", stiffness: 400, damping: 40, mass: 1 };
const INSTANT: Transition = { duration: 0 };
const ROW_STAGGER = 0.035;

/**
 * A card that opens from its top edge: its height springs open while a clip
 * inset uncovers it, and its `RevealRow` children follow one after another.
 * Instant under reduced motion.
 */
export function CardReveal({ className, children, ...props }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { clipPath: "inset(0 0 100% 0 round 20px)", opacity: 0.4 }}
      animate={{
        // Ends outside the card so its shadow isn't clipped.
        clipPath: "inset(-16px -16px -16px -16px round 20px)",
        opacity: 1,
        transition: reduce
          ? INSTANT
          : { ...SPRING, staggerChildren: ROW_STAGGER, delayChildren: 0.06 },
      }}
      transition={reduce ? INSTANT : SPRING}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const ROW = {
  hidden: { opacity: 0, y: 6 },
  shown: { opacity: 1, y: 0 },
};

/** A row inside `CardReveal` (or `Rows`): fades up in turn. */
export function RevealRow({ className, ...props }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={reduce ? undefined : ROW}
      initial={reduce ? false : "hidden"}
      animate="shown"
      transition={reduce ? INSTANT : SPRING}
      className={className}
      {...props}
    />
  );
}

/**
 * A block that springs open to its height when it first appears (e.g. a quote
 * arriving under a plan line), with its `RevealRow`s staggered.
 */
export function Expand({ className, ...props }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { height: 0, opacity: 0 }}
      animate={{
        height: "auto",
        opacity: 1,
        transition: reduce ? INSTANT : { ...SPRING, staggerChildren: ROW_STAGGER },
      }}
      exit={reduce ? undefined : { height: 0, opacity: 0, transition: SPRING }}
      className={cn("overflow-hidden", className)}
      {...props}
    />
  );
}

/**
 * Text whose characters roll into place (tabular figures): each changed
 * character slides up from below. Plain text under reduced motion.
 */
export function RollText({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={cn("tabular-nums", className)}>{value}</span>;
  return (
    <span className={cn("inline-flex tabular-nums", className)} aria-label={value}>
      {[...value].map((char, i) => (
        <span key={i} aria-hidden className="relative inline-block overflow-hidden">
          <AnimatePresence initial mode="popLayout">
            <motion.span
              key={char}
              className="inline-block"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ ...SPRING, delay: i * 0.012 }}
            >
              {char === " " ? "\u00a0" : char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/** Fades and slides content in once, e.g. a new message or the plan card. */
export function Appear({
  delay = 0,
  y = 8,
  ...props
}: { delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE, delay }}
      {...props}
    />
  );
}

/** A check mark that draws itself inside a filled circle: the "bought" moment. */
function DrawnCheck() {
  return (
    <motion.svg
      viewBox="0 0 16 16"
      className="size-4"
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      aria-hidden
    >
      <circle cx="8" cy="8" r="8" className="fill-status-success-text" />
      <motion.path
        d="M4.6 8.3l2.2 2.1 4.6-4.8"
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-white"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.12, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

const spinner = <Loader2 className="size-3.5 animate-spin" />;

const STATUS: Record<BuyStep, { label: string; tone: string; icon: ReactNode }> = {
  waiting: {
    label: "Waiting",
    tone: "text-text-low",
    icon: <span className="size-1.5 rounded-full bg-current" />,
  },
  quoting: { label: "Getting a fresh quote", tone: "text-status-warning-text", icon: spinner },
  signing: {
    label: "Approve in your wallet",
    tone: "text-text-extra-high",
    icon: (
      <motion.span
        animate={{ rotate: [0, -12, 0, 12, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        className="inline-flex"
      >
        <PenLine className="size-3.5" />
      </motion.span>
    ),
  },
  sending: { label: "Confirming", tone: "text-status-warning-text", icon: spinner },
  bought: { label: "Bought", tone: "text-status-success-text", icon: <DrawnCheck /> },
  failed: {
    label: "Failed",
    tone: "text-status-error-text",
    icon: <XCircle className="size-3.5" />,
  },
};

/**
 * One swap's status, morphing in place as it moves signing → sending →
 * bought: the pill resizes on a spring while the old label rolls out and the
 * new one rolls in (the check draws itself). Instant under reduced motion.
 */
export function SwapStatus({ step }: { step: BuyStep }) {
  const reduce = useReducedMotion();
  const status = STATUS[step];
  return (
    <motion.span
      layout={!reduce}
      transition={reduce ? INSTANT : SPRING}
      className="inline-flex min-h-6 items-center justify-end overflow-hidden rounded-full bg-soft px-2.5"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={step}
          layout={!reduce}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -10 }}
          transition={reduce ? INSTANT : SPRING}
          className={cn("inline-flex items-center gap-1.5 font-medium", status.tone)}
        >
          {status.icon}
          {status.label}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

/** A thin ink bar that moves while something loads. */
export function ProgressBar({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      className={cn("h-0.5 w-full overflow-hidden bg-gray-100", className)}
    >
      <div className="h-full progress-indeterminate w-1/3 rounded-full bg-gray-1400" />
    </div>
  );
}
