import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The Tickertape mark: three rings in a row, seen from the side. Each ring's
 * near half is solid; its far half, seen through the ring, is hatched with
 * horizontal lines. Drawn on a 480 × 480 square (the app icon); `VIEWBOX` is
 * the mark alone, for inline use.
 */
const MARK = {
  /** The rings' far halves, filled with the hatch. */
  backs:
    "M157.51 123.75A58.76 115 0 0 0 157.51 353.75H202.64A58.76 115 0 0 1 202.64 123.75ZM216.48 123.75A58.76 115 0 0 0 216.48 353.75H261.61A58.76 115 0 0 1 261.61 123.75ZM275.45 123.75A58.76 115 0 0 0 275.45 353.75H320.57A58.76 115 0 0 1 320.57 123.75Z",
  /** The rings' near halves, solid, on top of the hatch. */
  fronts:
    "M157.51 123.75A58.76 115 0 0 1 157.51 353.75H202.64A58.76 115 0 0 0 202.64 123.75ZM216.48 123.75A58.76 115 0 0 1 216.48 353.75H261.61A58.76 115 0 0 0 261.61 123.75ZM275.45 123.75A58.76 115 0 0 1 275.45 353.75H320.57A58.76 115 0 0 0 320.57 123.75Z",
  /** Hatch: one line every `period`, `line` thick, starting at `y`. */
  hatch: { period: 4.07, line: 1.92, y: 0.5 },
} as const;

const VIEWBOX = "98 123 283 232";

/** The app icon's background (the mark is white on it). */
export const MARK_INK = "#000000";

const hatchPattern = (id: string, fill: string) =>
  `<pattern id="${id}" width="480" height="${MARK.hatch.period}" y="${MARK.hatch.y}" patternUnits="userSpaceOnUse"><rect width="480" height="${MARK.hatch.line}" fill="${fill}"/></pattern>`;

/**
 * The mark as a standalone SVG document (for ImageResponse): the full 480 square
 * on `bg` when given, else just the mark on a transparent background.
 */
export function markSvg({ fg, bg }: { fg: string; bg?: string }): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bg ? "0 0 480 480" : VIEWBOX}">`,
    `<defs>${hatchPattern("hatch", fg)}</defs>`,
    bg ? `<rect width="480" height="480" fill="${bg}"/>` : "",
    `<path d="${MARK.backs}" fill="url(#hatch)"/>`,
    `<path d="${MARK.fronts}" fill="${fg}"/>`,
    `</svg>`,
  ].join("");
}

/** The mark inline, in `currentColor`. */
export function TickertapeMark({ className, title }: { className?: string; title?: string }) {
  const hatch = `tickertape-hatch-${useId()}`;
  return (
    <svg
      viewBox={VIEWBOX}
      className={cn("h-8 w-auto shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <pattern
          id={hatch}
          width="480"
          height={MARK.hatch.period}
          y={MARK.hatch.y}
          patternUnits="userSpaceOnUse"
        >
          <rect width="480" height={MARK.hatch.line} fill="currentColor" />
        </pattern>
      </defs>
      <path d={MARK.backs} fill={`url(#${hatch})`} />
      <path d={MARK.fronts} fill="currentColor" />
    </svg>
  );
}
