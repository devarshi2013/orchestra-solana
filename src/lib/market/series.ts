/**
 * Pure helpers that turn stored history and live price ticks into chart data
 * (Liveline points are `{ time: unix seconds, value }`). Nothing here invents
 * a number: every point is a real candle close or a real polled price.
 */

export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type Point = { time: number; value: number };

/** A polled live price. */
export type Tick = Point;

/** Most live ticks kept per token (about 4.5 hours at one tick every 8 s). */
export const MAX_TICKS = 2_000;

/** Adds a tick, skipping repeats of the same timestamp and trimming old ones. */
export function appendTick(ticks: readonly Tick[], tick: Tick): Tick[] {
  const last = ticks.at(-1);
  if (last && tick.time <= last.time) return ticks as Tick[];
  const next = [...ticks, tick];
  return next.length > MAX_TICKS ? next.slice(next.length - MAX_TICKS) : next;
}

/**
 * History closes followed by the live ticks that came after them, limited to
 * the last `windowSecs` (measured back from the newest point).
 */
export function chartPoints(
  candles: readonly Candle[],
  ticks: readonly Tick[],
  windowSecs: number,
): Point[] {
  const history = candles.map((c) => ({ time: c.time, value: c.close }));
  const lastHistory = history.at(-1)?.time ?? Number.NEGATIVE_INFINITY;
  const points = [...history, ...ticks.filter((t) => t.time > lastHistory)];
  const newest = points.at(-1)?.time;
  if (newest === undefined) return [];
  return points.filter((p) => p.time >= newest - windowSecs);
}

/**
 * The in-progress candle for `nowSec`: continues the newest history candle if
 * it's the current bucket, else opens a new one at the last close. Its close,
 * high and low follow the live price. Null without any price.
 */
export function liveCandle(
  candles: readonly Candle[],
  widthSecs: number,
  price: number | null,
  nowSec: number,
): Candle | null {
  const bucket = Math.floor(nowSec / widthSecs) * widthSecs;
  const last = candles.at(-1);
  if (price === null) return last && last.time === bucket ? last : null;
  if (last && last.time === bucket) {
    return {
      ...last,
      close: price,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
    };
  }
  const open = last?.close ?? price;
  return {
    time: bucket,
    open,
    high: Math.max(open, price),
    low: Math.min(open, price),
    close: price,
  };
}

/** Committed candles only (the live one is passed separately). */
export function closedCandles(
  candles: readonly Candle[],
  widthSecs: number,
  nowSec: number,
): Candle[] {
  const bucket = Math.floor(nowSec / widthSecs) * widthSecs;
  return candles.filter((c) => c.time < bucket);
}

/** Change over the visible window, percent, from its first to last point. */
export function windowChangePct(points: readonly Point[]): number | null {
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  if (first === undefined || last === undefined || first === 0) return null;
  return ((last - first) / first) * 100;
}

// --- Formatting ---------------------------------------------------------------

/** "$108.86", "$0.3706", "$0.00001234": enough digits to see movement. */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: abs >= 0.01 ? digits : 8,
  })}`;
}

/** "$64.1B", "$5.55M", "$958K". */
export function formatCompactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
}

/** "3.82M" holders. */
export function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(
    value,
  );
}

/** "+1.29%", "−0.90%" (true minus sign). */
export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}
