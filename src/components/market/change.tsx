import { cn } from "@/lib/utils";

import { formatPctAbs } from "./format";

/** tokens.xyz's filled triangle: up, or turned over for down. */
function Triangle({ down, className }: { down: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 10 8"
      aria-hidden
      className={cn("size-2 shrink-0 fill-current", down && "rotate-180", className)}
    >
      <path d="M5 0.5 9.5 7.5H0.5z" />
    </svg>
  );
}

/** A percent change with its triangle, green up / red down; an em dash when unknown. */
export function Change({
  pct,
  className,
  tone = "table",
}: {
  pct: number | null | undefined;
  className?: string;
  /** "table" is tokens.xyz's 800 shades; "accent" the brighter 600/700 of cards and charts. */
  tone?: "table" | "accent";
}) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className={cn("text-text-extra-low", className)}>—</span>;
  }
  const down = pct < 0;
  const color =
    tone === "table"
      ? down
        ? "text-red-800"
        : "text-green-800"
      : down
        ? "text-red-600"
        : "text-emerald-700";
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", color, className)}>
      <Triangle down={down} />
      <span className="sr-only">{down ? "down" : "up"}</span>
      {formatPctAbs(pct)}
    </span>
  );
}
