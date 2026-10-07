import type { MarketData } from "@/lib/symphony/market-data";

/**
 * Pure candle helpers shared by the sync job and its tests. Times are Unix
 * seconds (UTC), matching Birdeye. Client-safe: no server imports.
 */

export type CandleInterval = "1D" | "1H";

export const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "1H": 60 * 60,
  "1D": 24 * 60 * 60,
};

export type Candle = {
  mint: string;
  interval: CandleInterval;
  /** Unix seconds at the start of the candle. */
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Token units. */
  volume: number;
  volumeUsd: number | null;
};

/** Start of the candle containing `time`. Daily candles start at 00:00 UTC. */
export function candleOpenAt(time: number, interval: CandleInterval): number {
  const width = INTERVAL_SECONDS[interval];
  return Math.floor(time / width) * width;
}

/** Whether the candle has fully closed by `now`, i.e. its values are final. */
export function isClosed(openTime: number, interval: CandleInterval, now: number): boolean {
  return openTime + INTERVAL_SECONDS[interval] <= now;
}

/**
 * Splits [from, to] (inclusive candle open times) into request windows of at
 * most `maxCandles` candles each, oldest first.
 */
export function planWindows(
  from: number,
  to: number,
  interval: CandleInterval,
  maxCandles: number,
): { from: number; to: number }[] {
  const width = INTERVAL_SECONDS[interval];
  const windows: { from: number; to: number }[] = [];
  for (let start = from; start <= to; start += width * maxCandles) {
    windows.push({ from: start, to: Math.min(to, start + width * (maxCandles - 1)) });
  }
  return windows;
}

/** ISO date (YYYY-MM-DD) of a daily candle. */
export function toDateKey(openTime: number): string {
  return new Date(openTime * 1000).toISOString().slice(0, 10);
}

/**
 * Daily candles → the aligned MarketData evaluate() reads: one bar per UTC day
 * from the earliest to the latest candle, `null` where a mint has no candle
 * (not yet listed, or a gap Birdeye didn't fill).
 */
export function toMarketData(candles: readonly Candle[], mints: readonly string[]): MarketData {
  const daily = candles.filter((c) => c.interval === "1D");
  if (daily.length === 0) {
    return { dates: [], closes: Object.fromEntries(mints.map((mint) => [mint, []])) };
  }
  const day = INTERVAL_SECONDS["1D"];
  const opens = daily.map((c) => candleOpenAt(c.openTime, "1D"));
  const first = Math.min(...opens);
  const last = Math.max(...opens);
  const length = (last - first) / day + 1;

  const dates = Array.from({ length }, (_, i) => toDateKey(first + i * day));
  const closes: Record<string, (number | null)[]> = Object.fromEntries(
    mints.map((mint) => [mint, new Array<number | null>(length).fill(null)]),
  );
  daily.forEach((candle, i) => {
    const series = closes[candle.mint];
    if (series) series[(opens[i]! - first) / day] = candle.close;
  });
  return { dates, closes };
}
