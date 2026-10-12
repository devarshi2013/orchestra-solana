"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";

import { Change } from "@/components/market/change";
import { formatPrice } from "@/components/market/format";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useStockHistory } from "@/hooks/use-markets";
import type { Candle } from "@/lib/market/series";
import { CHART_WINDOWS, type ChartWindow } from "@/lib/stocks/api";

const WINDOW_LABELS: Record<ChartWindow, string> = {
  "24h": "24H",
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
  "1y": "1Y",
};
const WINDOW_DAYS: Record<ChartWindow, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

const HEIGHT = 400;
const PAD = { top: 16, right: 72, bottom: 32, left: 0 };
const INK = "#1C1C1D";
const LINE = "#5c5753";
const LABEL = "#6B6A75";
const GRID = "rgba(0,0,0,0.07)";
const UP = "#16a34a";
const DOWN = "#dc2626";

type Mode = "line" | "candle";
type Hover = { time: number; value: number };

const HOUR = 3600;
const DAY = 24 * HOUR;
/** Candidate x-axis spacings, smallest first. */
const TIME_STEPS = [
  HOUR,
  2 * HOUR,
  3 * HOUR,
  4 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  60 * DAY,
  90 * DAY,
];

/** 1, 2 or 5 × a power of ten: the y-axis step for about `count` ticks over `span`. */
function niceStep(span: number, count: number) {
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit >= 5 ? 10 : unit >= 2 ? 5 : unit >= 1.5 ? 2 : 1) * pow;
}

function timeLabel(secs: number, step: number) {
  const d = new Date(secs * 1000);
  if (step < DAY) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (step >= 30 * DAY) return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hoverLabel(secs: number, days: number) {
  const d = new Date(secs * 1000);
  return days <= 7
    ? d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The element's width, kept current. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const LineIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-4"
    aria-hidden
  >
    <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CandleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-4"
    aria-hidden
  >
    <path d="M7 3v4M7 15v6M17 3v8M17 17v4" strokeLinecap="round" />
    <rect x="5" y="7" width="4" height="8" rx="1" />
    <rect x="15" y="11" width="4" height="6" rx="1" />
  </svg>
);

/**
 * The stock page's chart: the price (or the scrubbed one) and its change over
 * the timeframe, a 400px line or candle chart of the token's most liquid pool,
 * and timeframe / mode switches. One state at a time: loading, error, no data,
 * or the chart.
 */
export function PriceChart({ mint, livePrice }: { mint: string; livePrice: number | null }) {
  const [range, setRange] = useState<ChartWindow>("24h");
  const [mode, setMode] = useState<Mode>("line");
  const [hover, setHover] = useState<Hover | null>(null);
  const history = useStockHistory(mint, range);
  const candles = history.data?.candles ?? [];
  const days = WINDOW_DAYS[range];
  const first = candles[0]?.open;

  const shown = hover?.value ?? livePrice;
  const change = shown != null && first ? ((shown - first) / first) * 100 : null;
  const state = history.data
    ? candles.length > 1
      ? "chart"
      : "empty"
    : history.error
      ? "error"
      : "loading";

  return (
    <div>
      <div className="border-t border-border-light">
        <div className="flex flex-col gap-1 py-4 sm:py-6">
          <p className="text-3xl font-semibold text-text-extra-high tabular-nums">
            {formatPrice(shown)}
          </p>
          <div className="flex items-center gap-1 text-xs font-medium">
            <Change pct={change} tone="accent" />
            <span className="ml-1 text-text-low">
              {hover ? hoverLabel(hover.time, days) : `Past ${WINDOW_LABELS[range]}`}
            </span>
          </div>
        </div>
        <div className="relative" style={{ height: HEIGHT }}>
          {state === "chart" ? (
            <Chart key={`${mint}:${range}`} candles={candles} mode={mode} onHover={setHover} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-[20px] bg-[#FAFAFC]">
              {state === "loading" ? (
                <span className="text-[13px] text-text-low" aria-busy>
                  Loading chart…
                </span>
              ) : (
                <span
                  role={state === "error" ? "alert" : undefined}
                  className="text-[13px] text-text-medium"
                >
                  {state === "error"
                    ? `Couldn't load the chart. ${history.error}`
                    : "No chart data for this token"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="Timeframe"
          items={CHART_WINDOWS.map((w) => ({ value: w, label: WINDOW_LABELS[w] }))}
          value={range}
          onValueChange={(w) => {
            setHover(null);
            setRange(w);
          }}
        />
        <SegmentedControl
          aria-label="Chart display mode"
          className="w-fit shrink-0 [&>button]:size-8 [&>button]:px-0 [&>button]:py-0 [&>button_span_span:last-child]:sr-only"
          items={[
            { value: "line", label: "Line chart", icon: <LineIcon /> },
            { value: "candle", label: "Candlestick chart", icon: <CandleIcon /> },
          ]}
          value={mode}
          onValueChange={setMode}
          disabled={state !== "chart"}
        />
      </div>
    </div>
  );
}

function Chart({
  candles,
  mode,
  onHover,
}: {
  candles: Candle[];
  mode: Mode;
  onHover: (point: Hover | null) => void;
}) {
  const [ref, width] = useWidth();
  const reduce = useReducedMotion();
  const fillId = useId();
  const [index, setIndex] = useState<number | null>(null);

  const t0 = candles[0]!.time;
  const t1 = candles.at(-1)!.time;
  const lows = candles.map((c) => (mode === "candle" ? c.low : c.close));
  const highs = candles.map((c) => (mode === "candle" ? c.high : c.close));
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  const span = hi - lo || hi * 0.01 || 1;
  const step = niceStep(span, 4);
  const yMin = Math.floor((lo - span * 0.08) / step) * step;
  const yMax = Math.ceil((hi + span * 0.08) / step) * step;

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(v);
  const timeStep = TIME_STEPS.find((s) => (s / (t1 - t0 || 1)) * plotW >= 96) ?? TIME_STEPS.at(-1)!;
  const xTicks: number[] = [];
  const startOfDay = (t: number) => {
    const d = new Date(t * 1000);
    d.setHours(0, 0, 0, 0);
    return d.getTime() / 1000;
  };
  for (
    let t = timeStep >= DAY ? startOfDay(t0) + DAY : Math.ceil(t0 / timeStep) * timeStep;
    t <= t1;
    t += timeStep
  ) {
    if (x(t) > PAD.left + 24 && x(t) < PAD.left + plotW - 24) xTicks.push(t);
  }

  const path = candles
    .map((c, i) => `${i ? "L" : "M"}${x(c.time).toFixed(1)} ${y(c.close).toFixed(1)}`)
    .join("");
  const area = `${path}L${x(t1).toFixed(1)} ${PAD.top + plotH}L${x(t0).toFixed(1)} ${PAD.top + plotH}Z`;
  const last = candles.at(-1)!;
  const up = last.close >= candles[0]!.open;
  const candleW = Math.max(Math.min((plotW / candles.length) * 0.65, 12), 1);
  const active = index === null ? null : candles[index]!;

  const move = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - box.left) / box.width) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < candles.length; i++) {
      if (Math.abs(candles[i]!.time - t) < Math.abs(candles[best]!.time - t)) best = i;
    }
    setIndex(best);
    onHover({ time: candles[best]!.time, value: candles[best]!.close });
  };
  const leave = () => {
    setIndex(null);
    onHover(null);
  };

  return (
    <div ref={ref} className="h-full w-full select-none">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="block overflow-visible"
          role="img"
          aria-label="Price chart"
        >
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={LINE} stopOpacity="0.1" />
              <stop offset="1" stopColor={LINE} stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke={GRID} />
              <text
                x={PAD.left + plotW + 10}
                y={y(v) + 4}
                fill={LABEL}
                fontSize="11.5"
                className="tabular-nums"
              >
                {formatPrice(v)}
              </text>
            </g>
          ))}
          <line
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke="rgba(0,0,0,0.1)"
          />
          {xTicks.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={PAD.top + plotH}
                y2={PAD.top + plotH + 4}
                stroke="rgba(0,0,0,0.15)"
              />
              <text
                x={x(t)}
                y={HEIGHT - 8}
                fill={LABEL}
                fontSize="11.5"
                textAnchor="middle"
                className="tabular-nums"
              >
                {timeLabel(t, timeStep)}
              </text>
            </g>
          ))}

          <motion.g
            initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {mode === "line" ? (
              <>
                <path d={area} fill={`url(#${fillId})`} />
                <path
                  d={path}
                  fill="none"
                  stroke={LINE}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            ) : (
              candles.map((c) => {
                const color = c.close >= c.open ? UP : DOWN;
                const top = y(Math.max(c.open, c.close));
                return (
                  <g key={c.time}>
                    <line
                      x1={x(c.time)}
                      x2={x(c.time)}
                      y1={y(c.high)}
                      y2={y(c.low)}
                      stroke={color}
                    />
                    <rect
                      x={x(c.time) - candleW / 2}
                      y={top}
                      width={candleW}
                      height={Math.max(y(Math.min(c.open, c.close)) - top, 1)}
                      rx={Math.min(candleW / 4, 1.5)}
                      fill={color}
                    />
                  </g>
                );
              })
            )}
          </motion.g>

          {/* The last price, as a tag on the price axis. */}
          <g transform={`translate(${PAD.left + plotW + 4} ${y(last.close)})`}>
            <rect
              x="0"
              y="-10"
              width={formatPrice(last.close).length * 7 + 12}
              height="20"
              rx="6"
              fill={up ? UP : DOWN}
            />
            <text x="6" y="4" fill="#fff" fontSize="11.5" fontWeight="600" className="tabular-nums">
              {formatPrice(last.close)}
            </text>
          </g>

          {active && (
            <g pointerEvents="none">
              <line
                x1={x(active.time)}
                x2={x(active.time)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="rgba(0,0,0,0.25)"
              />
              <circle
                cx={x(active.time)}
                cy={y(active.close)}
                r="4.5"
                fill={INK}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            style={{ cursor: "crosshair", touchAction: "pan-y" }}
            onPointerMove={move}
            onPointerDown={move}
            onPointerLeave={leave}
          />
        </svg>
      )}
    </div>
  );
}
