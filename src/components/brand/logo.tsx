import { cn } from "@/lib/utils";

/**
 * The Quill mark: a fountain-pen nib pointing up (it doubles as an "up"
 * arrow), with a white slit down the centre and a white breather hole. Flat and
 * geometric. One set of shapes shared by the UI, the favicon
 * (src/app/icon.svg), the app icons, the OG image and public/brand/*.svg, so
 * they always match.
 */
export const NIB_PATH =
  "M16 2.5C19.6 7.6 25.5 13.2 25.5 19L21.6 29.5H10.4L6.5 19C6.5 13.2 12.4 7.6 16 2.5Z";
/** The slit, from just below the tip to the breather hole. */
export const SLIT = { x1: 16, y1: 6, x2: 16, y2: 16.5, width: 1.6 } as const;
export const HOLE = { cx: 16, cy: 19, r: 2.6 } as const;

export const LOGO_COLORS = {
  light: { nib: "#0F1B2D", slit: "#FFFFFF", hole: "#FFFFFF" },
  dark: { nib: "#F9FAFB", slit: "#0A0A0A", hole: "#0A0A0A" },
} as const;

/** Icon only. Follows the theme: a navy nib on light, a white nib on dark and on the navy bars. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={NIB_PATH} style={{ fill: "var(--logo-nib)" }} />
      <line
        {...SLIT}
        strokeWidth={SLIT.width}
        strokeLinecap="round"
        style={{ stroke: "var(--logo-slit)" }}
      />
      <circle {...HOLE} style={{ fill: "var(--gold-fill)" }} />
    </svg>
  );
}

/** Mark + "quill" in the display serif, for the header and footer. */
export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark className={cn("size-7", markClassName)} />
      <span
        aria-hidden
        className="font-serif text-[1.375rem] leading-none font-semibold tracking-[-0.02em] text-foreground"
      >
        quill
      </span>
      <span className="sr-only">Quill</span>
    </span>
  );
}
