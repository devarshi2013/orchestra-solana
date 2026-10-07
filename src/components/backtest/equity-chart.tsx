"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { formatDay, formatUsd, niceTicks } from "@/lib/backtest/format";
import type { EquityPoint } from "@/lib/backtest/types";

const WIDTH = 720;
const HEIGHT = 280;
const MARGIN = { top: 12, right: 76, bottom: 28, left: 60 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

/** Colors are Tailwind classes (not inline var()) so Tailwind keeps the tokens and SVG resolves them. */
type Series = {
  key: "value" | "benchmark";
  label: string;
  stroke: string;
  fill: string;
  swatch: string;
};
const SERIES: Series[] = [
  {
    key: "value",
    label: "Strategy",
    stroke: "stroke-series-1",
    fill: "fill-series-1",
    swatch: "bg-series-1",
  },
  {
    key: "benchmark",
    label: "Hold SOL",
    stroke: "stroke-series-2",
    fill: "fill-series-2",
    swatch: "bg-series-2",
  },
];

/** Strategy vs. hold-SOL equity, with a crosshair tooltip and a table view. */
export function EquityChart({ points }: { points: readonly EquityPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  const series = SERIES.filter((s) => points.every((p) => p[s.key] !== null));
  const all = points.flatMap((p) => series.map((s) => p[s.key]!));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.05 || hi * 0.05 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const last = Math.max(1, points.length - 1);
  const x = (i: number) => MARGIN.left + (i / last) * PLOT_W;
  const y = (v: number) => MARGIN.top + (1 - (v - yMin) / (yMax - yMin)) * PLOT_H;
  const path = (key: Series["key"]) =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]!).toFixed(1)}`).join("");

  const xTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * last)))];
  const endLabels = placeEndLabels(series.map((s) => ({ ...s, y: y(points[last]![s.key]!) })));

  const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
    const box = svgRef.current!.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    setHover(Math.min(last, Math.max(0, Math.round(((px - MARGIN.left) / PLOT_W) * last))));
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setHover((h) => Math.min(last, Math.max(0, (h ?? last) + step)));
  };

  const active = hover === null ? null : points[hover]!;
  return (
    <figure className="space-y-3">
      <ul className="flex gap-4 text-sm text-muted-foreground" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`h-0.5 w-4 rounded-full ${s.swatch}`} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setHover(null)}
        >
          <title id={titleId}>
            {`Equity from ${formatUsd(points[0]!.value)} to ${formatUsd(points[last]!.value)}. Use arrow keys to read values.`}
          </title>
          {niceTicks(yMin, yMax).map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + PLOT_W}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatUsd(tick, true)}
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
              className="fill-muted-foreground text-[11px]"
            >
              {formatDay(points[i]!.date)}
            </text>
          ))}
          {series.map((s) => (
            <path
              key={s.key}
              d={path(s.key)}
              fill="none"
              className={s.stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {endLabels.map((s) => (
            <text
              key={s.key}
              x={MARGIN.left + PLOT_W + 8}
              y={s.labelY}
              dy="0.32em"
              className="fill-foreground text-[11px] font-medium"
            >
              {s.label}
            </text>
          ))}
          {active && (
            <g pointerEvents="none">
              <line
                x1={x(hover!)}
                x2={x(hover!)}
                y1={MARGIN.top}
                y2={MARGIN.top + PLOT_H}
                className="stroke-muted-foreground"
                strokeDasharray="3 3"
              />
              {series.map((s) => (
                <circle
                  key={s.key}
                  cx={x(hover!)}
                  cy={y(active[s.key]!)}
                  r={4}
                  className={`stroke-background ${s.fill}`}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm"
            style={
              hover! / last > 0.6
                ? { right: `${100 - (x(hover!) / WIDTH) * 100 + 2}%` }
                : { left: `${(x(hover!) / WIDTH) * 100 + 2}%` }
            }
          >
            <div className="mb-1 text-muted-foreground">{formatDay(active.date)}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`h-0.5 w-3 rounded-full ${s.swatch}`} />
                <span className="font-semibold tabular-nums">{formatUsd(active[s.key]!)}</span>
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show data table</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1 font-medium">Date</th>
                {series.map((s) => (
                  <th key={s.key} className="px-2 py-1 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t">
                  <td className="px-2 py-1">{p.date}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-2 py-1 text-right">
                      {formatUsd(p[s.key]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Keeps end-of-line labels at least 14px apart so they never overlap. */
function placeEndLabels<T extends { y: number }>(labels: T[]): (T & { labelY: number })[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y).map((l) => ({ ...l, labelY: l.y }));
  for (let i = 1; i < sorted.length; i++) {
    sorted[i]!.labelY = Math.max(sorted[i]!.labelY, sorted[i - 1]!.labelY + 14);
  }
  return sorted;
}
