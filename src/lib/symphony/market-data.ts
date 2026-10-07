/**
 * Daily closes for every mint a symphony touches, on one shared date axis.
 * Crypto trades every day, so one aligned axis avoids per-series date joins.
 */
export type MarketData = {
  /** Ascending, unique ISO dates (YYYY-MM-DD). */
  dates: readonly string[];
  /**
   * Closes aligned with `dates`. `null` (or a non-positive / non-finite value)
   * means no usable price that day, e.g. before the token listed.
   */
  closes: Readonly<Record<string, readonly (number | null)[]>>;
};

/** Thrown when an indicator needs more history than the data holds. */
export class InsufficientDataError extends Error {
  constructor(
    readonly mint: string,
    readonly barsNeeded: number,
    readonly date: string,
  ) {
    super(`Need ${barsNeeded} daily closes of ${mint} up to ${date}`);
    this.name = "InsufficientDataError";
  }
}

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

/** The `bars` closes of `mint` ending at `endIndex` (inclusive), oldest first. */
export function closesWindow(
  data: MarketData,
  mint: string,
  endIndex: number,
  bars: number,
  date: string,
): number[] {
  const series = data.closes[mint];
  const start = endIndex - bars + 1;
  if (!series || start < 0) throw new InsufficientDataError(mint, bars, date);
  const window: number[] = [];
  for (let i = start; i <= endIndex; i++) {
    const close = series[i];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      throw new InsufficientDataError(mint, bars, date);
    }
    window.push(close);
  }
  return window;
}
