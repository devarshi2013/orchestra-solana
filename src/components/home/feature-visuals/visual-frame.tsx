"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The box every feature visual lives in: the same 5:4 area the old graphics
 * filled, so the cards keep their size. Content uses most of the card's
 * padding too (negative inset), which leaves the card's own geometry alone.
 * `children` gets `active` (the card is on screen) and `reduce` (the visitor
 * prefers reduced motion): animations run only while active and not reduced.
 * CSS animations inside also pause off screen (`data-paused`, globals.css).
 */
export function VisualFrame({
  label,
  className,
  children,
}: {
  /** What the visual shows, for screen readers. */
  label: string;
  className?: string;
  children: (state: { active: boolean; reduce: boolean }) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref, { amount: 0.35 });
  const reduce = usePrefersReducedMotion();
  return (
    <div
      ref={ref}
      data-visual
      data-paused={active ? undefined : ""}
      role="group"
      aria-label={label}
      className="relative aspect-[5/4] w-full"
    >
      <div className={cn("absolute -inset-3 flex flex-col sm:-inset-7", className)}>
        {children({ active, reduce })}
      </div>
    </div>
  );
}

const REDUCE = "(prefers-reduced-motion: reduce)";
/**
 * Whether the visitor asked for reduced motion. False while the server-rendered
 * HTML is being hydrated (the server can't know), then the real value, so the
 * first render always matches the server's.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/**
 * Types `text` out one character at a time while `run` is true; `instant`
 * shows it all at once (reduced motion). Returns the text so far and whether
 * it's complete. Changing `text` starts again.
 */
export function useTyping(text: string, run: boolean, instant: boolean, ms = 55) {
  const [state, setState] = useState({ text, n: 0 });
  const n = state.text === text ? state.n : 0;
  const done = instant || n >= text.length;
  useEffect(() => {
    if (!run || done) return;
    const id = window.setInterval(
      () => setState((prev) => ({ text, n: prev.text === text ? prev.n + 1 : 1 })),
      ms,
    );
    return () => window.clearInterval(id);
  }, [text, run, done, ms]);
  return { value: instant ? text : text.slice(0, n), done };
}
