/**
 * Closes for every mint a symphony touches, on one shared time axis (one bar
 * per day for daily candles). Crypto trades every day, so one aligned axis
 * avoids per-series date joins. Build it from stored candles with
 * `toMarketData` in lib/market.
 */
export type MarketData = {
  /** Ascending, unique ISO dates (YYYY-MM-DD) or timestamps; compared as strings. */
  dates: readonly string[];
  /**
   * Closes aligned with `dates`. `null` (or a non-positive / non-finite value)
   * means no usable price that bar, e.g. before the token listed.
   */
  closes: Readonly<Record<string, readonly (number | null)[]>>;
};

/**
 * Index of the last bar on or before `date`, or -1. Using the last bar *on or
 * before* the date means evaluation never looks ahead.
 */
export function barIndexAt(dates: readonly string[], date: string): number {
  let lo = 0;
  let hi = dates.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid]! <= date) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

const isUsable = (close: number | null | undefined): close is number =>
  typeof close === "number" && Number.isFinite(close) && close > 0;

/**
 * The unbroken run of usable closes of `mint` ending at `endIndex`, oldest
 * first. Empty when the mint has no data there. A gap cuts history short, so
 * a token that stopped trading for a while reads as having a short history.
 */
export function historyAt(data: MarketData, mint: string, endIndex: number): number[] {
  const series = data.closes[mint] ?? [];
  let start = endIndex + 1;
  while (start > 0 && isUsable(series[start - 1])) start--;
  return series.slice(start, endIndex + 1) as number[];
}
