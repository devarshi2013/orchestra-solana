import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Decorative pieces for the dark home page, all CSS/SVG: blurred gradient
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
      <div className="absolute -top-40 left-[8%] size-[26rem] rounded-full bg-[radial-gradient(circle,rgb(30_58_138/0.55),rgb(15_27_45/0)_70%)] blur-3xl motion-safe:animate-orb sm:size-[40rem]" />
      <div className="absolute top-24 right-[4%] hidden size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(59_91_219/0.28),rgb(15_27_45/0)_70%)] blur-3xl [animation-delay:-9s] motion-safe:animate-orb sm:block" />
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

/** A very faint film grain over the whole page (about 3.5% opacity). */
export function Grain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-grain opacity-[0.035]" />
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
        "group relative rounded-2xl bg-[linear-gradient(140deg,rgb(201_208_215/0.38),rgb(201_208_215/0.08)_38%,rgb(59_91_219/0.18)_100%)] p-px transition-transform duration-300 motion-safe:hover:-translate-y-0.5",
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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(59_91_219/0.16),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        {children}
      </div>
    </div>
  );
}

/** Shared SVG gradient definitions for the home graphics (navy, blue, silver). */
export function HomeGradients({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#E6EAF0" />
        <stop offset="0.5" stopColor="#C9D0D7" stopOpacity="0.7" />
        <stop offset="1" stopColor="#3B5BDB" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3B5BDB" />
        <stop offset="1" stopColor="#0F1B2D" />
      </linearGradient>
      <radialGradient id={`${id}-glow`}>
        <stop offset="0" stopColor="#3B5BDB" stopOpacity="0.55" />
        <stop offset="1" stopColor="#1E3A8A" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
