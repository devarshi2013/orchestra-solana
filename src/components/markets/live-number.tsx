"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A price that glides to its new value (~400 ms) and flashes green or red for
 * a moment when it changes. Updated directly on the DOM (no re-renders per
 * frame); only the text and an overlay's opacity change.
 */
export function LiveNumber({
  value,
  format,
  className,
}: {
  value: number | null;
  format: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const text = useRef<HTMLSpanElement>(null);
  const flash = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  // The first text only; later values are written straight to the DOM in the effect.
  const [initialText] = useState(() => (value === null ? "—" : format(value)));

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    const el = text.current;
    if (!el) return;
    if (value === null || from === null || from === value || reduce) {
      el.textContent = value === null ? "—" : format(value);
      if (value === null || from === null || from === value) return;
    }
    const overlay = flash.current;
    if (overlay) {
      overlay.dataset.dir = value > from ? "up" : "down";
      overlay.style.opacity = "1";
    }
    const clear = setTimeout(() => {
      if (overlay) overlay.style.opacity = "0";
    }, 700);
    const controls = reduce
      ? null
      : animate(from, value, {
          duration: 0.4,
          ease: "easeOut",
          onUpdate: (n) => {
            el.textContent = format(n);
          },
        });
    return () => {
      controls?.stop();
      clearTimeout(clear);
    };
  }, [value, reduce, format]);

  return (
    <span className={cn("relative inline-block rounded px-1 font-mono tabular-nums", className)}>
      <span
        ref={flash}
        aria-hidden
        className="absolute inset-0 rounded opacity-0 transition-opacity duration-500 ease-out data-[dir=down]:bg-loss/20 data-[dir=up]:bg-gain/20"
      />
      <span ref={text} className="relative">
        {initialText}
      </span>
    </span>
  );
}

/** "+1.23%" in green, "−0.45%" in red, "—" when unknown. */
export function ChangeText({ value, className }: { value: number | null; className?: string }) {
  if (value === null)
    return <span className={cn("font-mono text-muted-foreground", className)}>—</span>;
  const up = value >= 0;
  return (
    <span className={cn("font-mono tabular-nums", up ? "text-gain" : "text-loss", className)}>
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}
