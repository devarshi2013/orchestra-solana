import { mean } from "./moving-averages";

/**
 * Wilder's Relative Strength Index (0–100) at the latest close, or null with
 * fewer than `period + 1` closes. The first average gain/loss is a simple mean
 * of the first `period` changes; later ones use Wilder smoothing over the rest
 * of the series. Flat prices read 50; no losses read 100.
 */
export function rsi(closes: readonly number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!;
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }
  let avgGain = mean(gains.slice(0, period));
  let avgLoss = mean(losses.slice(0, period));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]!) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]!) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
