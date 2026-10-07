/**
 * Moving averages over closes (oldest first). Each returns the value at the
 * latest bar, or null when the series is shorter than the period.
 */

export function mean(values: readonly number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Simple moving average of the last `period` closes. */
export function sma(closes: readonly number[], period: number): number | null {
  if (closes.length < period) return null;
  return mean(closes.slice(closes.length - period));
}

/**
 * Exponential moving average, smoothing 2 / (period + 1), seeded with the SMA
 * of the first `period` closes and run over the whole series (the StockCharts
 * convention). The seed's influence fades after a few periods, so supply
 * several periods of history for values that match charting tools.
 */
export function ema(closes: readonly number[], period: number): number | null {
  if (closes.length < period) return null;
  const alpha = 2 / (period + 1);
  let value = mean(closes.slice(0, period));
  for (let i = period; i < closes.length; i++) value = alpha * closes[i]! + (1 - alpha) * value;
  return value;
}
