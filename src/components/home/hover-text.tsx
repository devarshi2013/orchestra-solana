"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared text hover pieces for the home page (styles in globals.css, under
 * "Home page: fonts, scrolling and text hover effects"). Mouse only; movement
 * is dropped under reduced motion, colour changes stay.
 */

/** Splits text into words that each lift slightly and brighten on hover. */
export function HoverWords({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <span className="hover-word">{word}</span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

/** An italic accent (Instrument Serif) in the silver-to-blue gradient, which sweeps on hover. */
export function Accent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <em className={cn("accent-sweep text-gradient-silver pr-[0.08em]", className)}>{children}</em>
  );
}

/** A small uppercase label (Geist Mono) that turns silver with an arrow sliding in when its row is hovered. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-mono text-xs font-medium tracking-[0.16em] text-[var(--label-blue)] uppercase transition-colors duration-300 ease-out group-hover/row:text-[var(--silver)]">
      <span
        aria-hidden
        className="-ml-4 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover/row:opacity-100 motion-safe:-translate-x-1.5 motion-safe:group-hover/row:translate-x-0"
      >
        →
      </span>
      {children}
    </p>
  );
}

/**
 * Pauses the CSS animations inside it (drifting orbs, turning rings) while it
 * is off screen, via IntersectionObserver and `[data-paused]` in globals.css.
 */
export function PauseOffscreen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) delete el.dataset.paused;
        else el.dataset.paused = "";
      },
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
