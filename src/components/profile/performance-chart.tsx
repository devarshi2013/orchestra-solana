"use client";

import { useEffect, useRef, useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePortfolioHistory, type HistoryState } from "@/hooks/use-profile";
import { HISTORY_PERIODS, type HistoryPeriod, type PortfolioPoint } from "@/lib/strategies/types";
import { cn } from "@/lib/utils";

import { HIDDEN, signedUsd, usd } from "./format";

type Metric = "value" | "pnl";

const RANGES = HISTORY_PERIODS.map((value) => ({ value, label: value.toUpperCase() }));
const METRICS = [
  { value: "value", label: "Value" },
  { value: "pnl", label: "P&L" },
] as const;

const HEIGHT = 168;
const PAD = { top: 10, bottom: 6 };

/** Unix seconds or milliseconds → milliseconds. */
const ms = (time: number) => (time < 1e12 ? time * 1000 : time);
const day = (time: number) =>
  new Date(ms(time)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** The wallet's value (or unrealized P&L) over time, from its daily server-side snapshots. */
export function PerformanceChart({
  hidden,
  sample,
}: {
  hidden: boolean;
  /** Dev preview only: shown instead of the signed-in wallet's history. */
  sample?: HistoryState;
}) {
  const [range, setRange] = useState<HistoryPeriod>("30d");
  const [metric, setMetric] = useState<Metric>("value");
  const live = usePortfolioHistory(range);
  const { points, error } = sample ?? live;

  return (
    <div className="flex h-full flex-col rounded-[24px] bg-white p-5 shadow-hairline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Chart"
          items={METRICS}
          value={metric}
          onValueChange={setMetric}
        />
        <SegmentedControl
          aria-label="Range"
          items={RANGES}
          value={range}
          onValueChange={setRange}
        />
      </div>
      <div className="relative mt-3 flex-1" style={{ minHeight: HEIGHT + 48 }}>
        {points == null ? (
          error ? (
            <Centered className="text-status-error-text">{error}</Centered>
          ) : (
            <div className="absolute inset-0 animate-pulse rounded-[16px] bg-soft" aria-busy />
          )
        ) : points.length < 2 ? (
          <Centered>Not enough history yet</Centered>
        ) : (
          <Plot points={points} metric={metric} hidden={hidden} />
        )}
      </div>
    </div>
  );
}

function Centered({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "absolute inset-0 flex items-center justify-center text-[13.5px] text-ink-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

function Plot({
  points,
  metric,
  hidden,
}: {
  points: PortfolioPoint[];
  metric: Metric;
  hidden: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const values = points.map((p) => p[metric]);
  const min = Math.min(...values, metric === "pnl" ? 0 : Infinity);
  const max = Math.max(...values, metric === "pnl" ? 0 : -Infinity);
  const span = max - min || Math.abs(max) || 1;
  const t0 = ms(points[0]!.time);
  const t1 = ms(points.at(-1)!.time);
  const x = (time: number) => ((ms(time) - t0) / (t1 - t0 || 1)) * width;
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (list: PortfolioPoint[]) =>
    list.map((p, i) => `${i ? "L" : "M"}${x(p.time)},${y(p[metric])}`).join("");
  const line = path(points);
  // Backfilled days count only holdings bought through Tickertape: drawn dashed, up to the first snapshot.
  const firstMeasured = points.findIndex((p) => p.source !== "backfill");
  const split = firstMeasured === -1 ? points.length : firstMeasured;
  const backfill = split > 0 ? path(points.slice(0, Math.min(split + 1, points.length))) : null;
  const measured = split < points.length ? path(points.slice(split)) : null;
  const last = values.at(-1)!;
  const up = metric === "pnl" ? last >= 0 : last >= values[0]!;
  const stroke = up ? "#059669" : "#DC2626";
  const shown = hover == null ? points.length - 1 : hover;
  const point = points[shown]!;
  const fmt = metric === "pnl" ? signedUsd : usd;

  const onMove = (e: React.PointerEvent) => {
    const left = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const at = t0 + (left / (width || 1)) * (t1 - t0);
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(ms(p.time) - at) < Math.abs(ms(points[best]!.time) - at)) best = i;
    });
    setHover(best);
  };

  return (
    <div ref={box} className="absolute inset-0">
      <div className="pointer-events-none absolute top-0 left-0 z-10">
        <p className="text-[17px] font-semibold tracking-[-0.01em] text-text-extra-high tabular-nums">
          {hidden ? HIDDEN : fmt(point[metric])}
        </p>
        <p className="text-[12px] text-ink-muted tabular-nums">
          {day(point.time)}
          {point.source === "backfill" && " · recorded buys only"}
        </p>
      </div>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="absolute bottom-0 left-0 touch-none overflow-visible"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${metric === "pnl" ? "P&L" : "Portfolio value"} over time`}
        >
          <defs>
            <linearGradient id="perf-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.12} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          {metric === "pnl" && min < 0 && max > 0 && (
            <line
              x1={0}
              x2={width}
              y1={y(0)}
              y2={y(0)}
              stroke="rgba(0,0,0,0.12)"
              strokeDasharray="3 4"
            />
          )}
          <path d={`${line}L${width},${HEIGHT}L0,${HEIGHT}Z`} fill="url(#perf-fill)" />
          {backfill && (
            <path
              d={backfill}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinejoin="round"
              opacity={0.6}
            />
          )}
          {measured && (
            <path d={measured} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
          )}
          {hover != null && (
            <>
              <line
                x1={x(point.time)}
                x2={x(point.time)}
                y1={0}
                y2={HEIGHT}
                stroke="rgba(0,0,0,0.12)"
              />
              <circle
                cx={x(point.time)}
                cy={y(point[metric])}
                r={4.5}
                fill={stroke}
                stroke="white"
                strokeWidth={2}
              />
            </>
          )}
        </svg>
      )}
    </div>
  );
}
