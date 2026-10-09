"use client";

import { AnimatePresence, MotionConfig, motion, type HTMLMotionProps } from "framer-motion";
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

/** Fades and slides content in once, e.g. a new message or the plan card. */
export function Appear({
  children,
  delay = 0,
  y = 8,
  className,
  ...props
}: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
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
      <circle cx="8" cy="8" r="8" className="fill-success" />
      <motion.path
        d="M4.6 8.3l2.2 2.1 4.6-4.8"
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-background"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.12, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

const STATUS: Record<BuyStep, { label: string; tone: string; icon: ReactNode }> = {
  waiting: {
    label: "Waiting",
    tone: "text-muted-foreground",
    icon: <span className="size-1.5 rounded-full bg-current" />,
  },
  quoting: {
    label: "Getting a fresh quote",
    tone: "text-warning",
    icon: <Loader2 className="size-3.5 animate-spin" />,
  },
  signing: {
    label: "Approve in your wallet",
    tone: "text-primary-text",
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
  sending: {
    label: "Confirming",
    tone: "text-warning",
    icon: <Loader2 className="size-3.5 animate-spin" />,
  },
  bought: { label: "Bought", tone: "text-success", icon: <DrawnCheck /> },
  failed: { label: "Failed", tone: "text-destructive", icon: <XCircle className="size-3.5" /> },
};

/** One swap's status, cross-fading as it moves pending → signing → confirmed. */
export function SwapStatus({ step }: { step: BuyStep }) {
  const status = STATUS[step];
  return (
    <span className="inline-flex min-h-5 items-center justify-end" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={step}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className={cn("inline-flex items-center gap-1.5 font-medium", status.tone)}
        >
          {status.icon}
          {status.label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
