import type { Metrics } from "./types";

/** Crypto trades every day. */
export const PERIODS_PER_YEAR = 365;

/**
 * Performance statistics of a daily equity curve (first point = starting
 * value). All rates are fractions (0.1 = 10%). Risk-free rate is 0.
 *
 * - CAGR annualizes over the curve's days: (end / start)^(365 / days) − 1.
 * - Volatility and Sharpe use the sample stdev of daily returns.
 * - Sortino divides by downside deviation: √(mean of min(r, 0)²) over all days.
 * - Ratios are null when undefined (fewer than 2 returns, or zero deviation).
 */
export function computeMetrics(values: readonly number[]): Metrics {
  const start = values[0]!;
  const end = values[values.length - 1]!;
  const days = values.length - 1;
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) returns.push(values[i]! / values[i - 1]! - 1);

  const annualize = Math.sqrt(PERIODS_PER_YEAR);
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const sampleStdev =
    returns.length >= 2
      ? Math.sqrt(returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1))
      : null;
  const downside =
    returns.length >= 2
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.min(r, 0) ** 2, 0) / returns.length)
      : null;

  return {
    totalReturn: end / start - 1,
    cagr: days > 0 ? (end / start) ** (PERIODS_PER_YEAR / days) - 1 : 0,
    maxDrawdown: maxDrawdown(values),
    volatility: sampleStdev === null ? null : sampleStdev * annualize,
    sharpe: sampleStdev ? (mean / sampleStdev) * annualize : null,
    sortino: downside ? (mean / downside) * annualize : null,
    winRate: returns.length ? returns.filter((r) => r > 0).length / returns.length : null,
  };
}

/** Largest peak-to-trough fall as a positive fraction. */
export function maxDrawdown(values: readonly number[]): number {
  let peak = values[0]!;
  let worst = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    worst = Math.max(worst, (peak - value) / peak);
  }
  return worst;
}
