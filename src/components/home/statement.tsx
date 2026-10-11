"use client";

import { useState } from "react";

import { Reveal } from "@/components/motion";

/**
 * The large centred punch line after the hero. Hovering it, focusing it with
 * the keyboard or tapping it lights it up: a brand gradient sweeps across the
 * letters, a glow fades in behind, and "edge" lifts over a highlighter
 * underline (globals.css, .punch).
 */
export function Statement() {
  // Hover sets it while the mouse is over; a tap toggles it and it stays.
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  return (
    <section aria-labelledby="statement-heading" className="relative section-y">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <Reveal>
          <h2
            id="statement-heading"
            tabIndex={0}
            data-lit={hovered || tapped ? "" : undefined}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onClick={() => setTapped((on) => !on)}
            className="punch relative mx-auto w-fit max-w-4xl text-5xl leading-[1.02] font-semibold tracking-tight sm:text-7xl md:text-8xl"
          >
            <span
              aria-hidden
              className="punch-glow pointer-events-none absolute inset-x-[10%] inset-y-0 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--glow-blue)_35%,transparent),transparent_70%)] opacity-0 blur-2xl"
            />
            <span className="punch-text">Clarity is the best</span>{" "}
            <span className="punch-edge">
              <span className="punch-text">edge.</span>
            </span>
          </h2>
          <p className="mx-auto section-head max-w-xl text-base text-muted-foreground sm:text-lg">
            Quill turns market noise into answers you can understand.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
