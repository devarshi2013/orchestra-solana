"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { solscanTxUrl } from "@/lib/solana";
import { cn } from "@/lib/utils";

/** A landed trade, as the toast shows it. Every figure comes from the recorded fill. */
export type PnlToastInput = {
  symbol: string;
  side: "buy" | "sell";
  usdcAmount: number;
  tokenAmount: number;
  /** USDC per token. */
  price: number;
  /** Realized P&L of a sell, percent (omit when unknown). */
  pnlPct?: number | null;
  signature: string;
};

type Toast = PnlToastInput & { id: number };

const SHOW_MS = 6_000;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const EMPTY: Toast[] = [];

const dismiss = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

/** Shows a fill toast (the newest three stay on screen; each leaves after 6 s). */
export function showPnlToast(input: PnlToastInput) {
  toasts = [...toasts.slice(-2), { ...input, id: nextId++ }];
  emit();
}

const amount = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 4 });
const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PnlToast({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id]);
  const gain = toast.pnlPct != null && toast.pnlPct >= 0;
  return (
    <div className="group pointer-events-auto relative flex w-[340px] max-w-[calc(100vw-24px)] items-center gap-3 rounded-[16px] bg-white p-3.5 pr-4 shadow-float">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-text-extra-high tabular-nums">
          {toast.side === "buy" ? "Bought" : "Sold"} {amount(toast.tokenAmount)} {toast.symbol}
          <span className="font-medium text-ink-muted"> · {usd(toast.usdcAmount)}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-muted tabular-nums">
          at {usd(toast.price)}
          {toast.pnlPct != null && (
            <span
              className={cn(
                "font-medium",
                gain ? "text-status-success-text" : "text-status-error-text",
              )}
            >
              {gain ? "+" : "−"}
              {Math.abs(toast.pnlPct).toFixed(2)}%
            </span>
          )}
        </p>
      </div>
      <a
        href={solscanTxUrl(toast.signature, "mainnet-beta")}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-soft px-3 text-[12.5px] font-medium text-text-extra-high transition-[background-color,box-shadow] hover:bg-white hover:shadow-hairline"
      >
        Solscan <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-white text-ink-muted opacity-0 shadow-hairline transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/** Where fill toasts appear: bottom-right on desktop, bottom-centre on phones. Mount once. */
export function PnlToaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
  const reduce = useReducedMotion();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      <AnimatePresence initial={false}>
        {list.map((toast) => (
          <motion.div
            key={toast.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
          >
            <PnlToast toast={toast} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
