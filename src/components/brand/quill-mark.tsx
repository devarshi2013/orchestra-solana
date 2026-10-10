import { cn } from "@/lib/utils";

/**
 * The Quill "Q" mark: a ring (the Q), a feather inside it, and the Q's tail
 * drawn as a pen nib. One set of shapes for the home navbar (white, inline)
 * and the navy app icon / favicon (src/app/icon.svg, apple-icon.tsx).
 * The thin cuts (feather shaft and barbs, nib slit and hole) are drawn in the
 * background colour so the mark reads on any surface.
 */
export const Q_MARK = {
  ring: "M21.74 23.19 A10 10 0 1 1 25.06 19.23",
  vane: "M11.2 20.6 C 11.6 15.2 15 10.9 20.9 8.4 C 20.6 14.4 16.9 18.6 11.2 20.6 Z",
  shaft: "M9.6 22.4 L 18.8 11.2",
  quill: "M9.4 22.6 L 11.4 20.2",
  barbs: "M17.6 15.6 L 19.4 15.0 M15.6 18.0 L 17.3 17.6 M14.2 12.6 L 14.5 11.3",
  nib: "M22.1 22.14 L 24.7 20.26 L 27.02 22.97 L 28.6 28.4 L 23.94 25.19 Z",
  slit: "M24.9 23.1 L 27.6 27.3",
  hole: { cx: 24.6, cy: 22.7, r: 0.65 },
} as const;

/** The navy of the app icon. */
export const Q_ICON_NAVY = "#0F1B2D";

/** The mark as SVG markup (for icon.svg-style files and ImageResponse). */
export function qMarkSvg({ fg, cut, bg }: { fg: string; cut: string; bg?: string }): string {
  return [
    bg ? `<rect width="32" height="32" rx="7" fill="${bg}"/>` : "",
    `<path d="${Q_MARK.ring}" fill="none" stroke="${fg}" stroke-width="2.2" stroke-linecap="round"/>`,
    `<path d="${Q_MARK.vane}" fill="${fg}"/>`,
    `<path d="${Q_MARK.shaft}" stroke="${cut}" stroke-width="0.9" stroke-linecap="round"/>`,
    `<path d="${Q_MARK.quill}" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>`,
    `<path d="${Q_MARK.barbs}" stroke="${cut}" stroke-width="0.7" stroke-linecap="round"/>`,
    `<path d="${Q_MARK.nib}" fill="${fg}"/>`,
    `<path d="${Q_MARK.slit}" stroke="${cut}" stroke-width="0.7" stroke-linecap="round"/>`,
    `<circle cx="${Q_MARK.hole.cx}" cy="${Q_MARK.hole.cy}" r="${Q_MARK.hole.r}" fill="${cut}"/>`,
  ].join("");
}

/** The mark inline, in `currentColor`, with its cuts in `cut` (the surface behind it). */
export function QuillMark({
  className,
  cut = "var(--background)",
  title,
}: {
  className?: string;
  cut?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d={Q_MARK.ring}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d={Q_MARK.vane} fill="currentColor" />
      <path d={Q_MARK.shaft} stroke={cut} strokeWidth="0.9" strokeLinecap="round" />
      <path d={Q_MARK.quill} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d={Q_MARK.barbs} stroke={cut} strokeWidth="0.7" strokeLinecap="round" />
      <path d={Q_MARK.nib} fill="currentColor" />
      <path d={Q_MARK.slit} stroke={cut} strokeWidth="0.7" strokeLinecap="round" />
      <circle {...Q_MARK.hole} fill={cut} />
    </svg>
  );
}
