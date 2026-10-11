import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Decorative pieces shared by the home and markets pages, all CSS/SVG: blurred gradient
 * orbs, a dot grid that fades out at its edges, a gradient-bordered card with
 * a hover glow, and a faint grain. Everything here is aria-hidden except the
 * card's children.
 */

/** Soft blurred orbs (deep blue to navy) drifting slowly. Smaller and fewer on phones. */
export function Orbs({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* The blur is fixed; only transform moves (animate-orb), so drifting stays cheap. */}
      <div className="absolute -top-40 left-[8%] size-[26rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--glow-deep)_55%,transparent),color-mix(in_srgb,var(--navy)_0%,transparent)_70%)] blur-3xl will-change-transform motion-safe:animate-orb sm:size-[40rem]" />
      <div className="absolute top-24 right-[4%] hidden size-[34rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--glow-blue)_28%,transparent),color-mix(in_srgb,var(--navy)_0%,transparent)_70%)] blur-3xl will-change-transform [animation-delay:-9s] motion-safe:animate-orb sm:block" />
    </div>
  );
}

/** A faint dot grid that fades out towards the edges (radial mask). */
export function GridOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.09)_1px,transparent_1.2px)] [mask-image:radial-gradient(ellipse_at_center,#000_15%,transparent_70%)] [background-size:22px_22px]",
        className,
      )}
    />
  );
}

/** A very faint film grain over the whole page (about 3.5% opacity); left out on phones to keep scrolling light. */
export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 hidden bg-grain opacity-[0.035] sm:block"
    />
  );
}

/**
 * A card with a thin silver-to-transparent gradient border and a soft inner
 * glow on hover. The text inside sits on the plain card surface.
 */
export function GradientCard({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-[linear-gradient(140deg,color-mix(in_srgb,var(--silver)_38%,transparent),color-mix(in_srgb,var(--silver)_8%,transparent)_38%,color-mix(in_srgb,var(--glow-blue)_18%,transparent)_100%)] p-px transition-transform duration-300 motion-safe:hover:-translate-y-0.5",
        className,
      )}
    >
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-[calc(1rem-1px)] bg-card",
          innerClassName,
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--glow-blue)_16%,transparent),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        {children}
      </div>
    </div>
  );
}
