import type { Point } from "@/lib/market/series";
import { cn } from "@/lib/utils";

/** A small 24h line, green when the price ended higher than it started, red when lower. SVG only. */
export function Sparkline({
  points,
  className,
}: {
  /** null: no history; undefined: still loading. */
  points: Point[] | null | undefined;
  className?: string;
}) {
  if (points === undefined)
    return <span className={cn("block h-8 w-24 animate-pulse rounded bg-muted", className)} />;
  if (!points || points.length < 2)
    return (
      <span className={cn("block h-8 w-24 text-center text-xs text-muted-foreground", className)}>
        —
      </span>
    );
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 96;
  const h = 32;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 2 - ((p.value - min) / span) * (h - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values.at(-1)! >= values[0]!;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-8 w-24", up ? "text-gain" : "text-loss", className)}
      // Stretches to whatever size it's given; the line keeps its thickness.
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
