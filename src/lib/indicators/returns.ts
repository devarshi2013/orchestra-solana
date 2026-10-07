import { mean } from "./moving-averages";

/**
 * Return-based indicators over the last `period` daily moves, i.e. the last
 * `period + 1` closes (oldest first). All in percent; null when too short.
 */

function lastMoves(closes: readonly number[], period: number): number[] | null {
  return closes.length < period + 1 ? null : closes.slice(closes.length - period - 1);
}

/** Percent change from `period` bars ago to the latest close. */
export function cumulativeReturn(closes: readonly number[], period: number): number | null {
  const window = lastMoves(closes, period);
  if (!window) return null;
  return (window[window.length - 1]! / window[0]! - 1) * 100;
}

/** Largest peak-to-trough fall within the window, as a positive percent. */
export function maxDrawdown(closes: readonly number[], period: number): number | null {
  const window = lastMoves(closes, period);
  if (!window) return null;
  let peak = window[0]!;
  let worst = 0;
  for (const close of window) {
    peak = Math.max(peak, close);
    worst = Math.max(worst, (peak - close) / peak);
  }
  return worst * 100;
}

/** Population standard deviation of the last `period` simple daily returns, in percent. */
export function stdevReturns(closes: readonly number[], period: number): number | null {
  const window = lastMoves(closes, period);
  if (!window) return null;
  const returns: number[] = [];
  for (let i = 1; i < window.length; i++) returns.push(window[i]! / window[i - 1]! - 1);
  return populationStdev(returns) * 100;
}

export function populationStdev(values: readonly number[]): number {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}
