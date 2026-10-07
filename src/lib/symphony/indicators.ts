import type { IndicatorSpec } from "./types";

/**
 * Pure indicator math over a window of daily closes (oldest first, all > 0).
 *
 * Every indicator reads a fixed number of bars (`barsRequired`), so a value
 * depends only on that window, never on how much older history happens to be
 * loaded. That keeps backtests and live evaluation identical. EMA and RSI are
 * seeded with a simple average over the first `period` bars of their window,
 * then smoothed over the next `period`.
 */

export function barsRequired(spec: IndicatorSpec): number {
  switch (spec.fn) {
    case "price":
      return 1;
    case "sma":
      return spec.period;
    case "ema":
      return 2 * spec.period;
    case "rsi":
      return 2 * spec.period + 1;
    case "cumulativeReturn":
    case "maxDrawdown":
    case "stdevReturn":
      return spec.period + 1;
  }
}

/** `closes` must hold at least `barsRequired(spec)` bars; only the most recent ones are used. */
export function computeIndicator(spec: IndicatorSpec, closes: readonly number[]): number {
  const window = closes.slice(closes.length - barsRequired(spec));
  switch (spec.fn) {
    case "price":
      return window[0]!;
    case "sma":
      return mean(window);
    case "ema":
      return ema(window, spec.period);
    case "rsi":
      return rsi(window, spec.period);
    case "cumulativeReturn":
      return (window[window.length - 1]! / window[0]! - 1) * 100;
    case "maxDrawdown":
      return maxDrawdown(window);
    case "stdevReturn":
      return stdev(dailyReturns(window)) * 100;
  }
}

function mean(values: readonly number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function dailyReturns(closes: readonly number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push(closes[i]! / closes[i - 1]! - 1);
  return returns;
}

/** Population standard deviation. */
function stdev(values: readonly number[]): number {
  const avg = mean(values);
  let sumSq = 0;
  for (const value of values) sumSq += (value - avg) ** 2;
  return Math.sqrt(sumSq / values.length);
}

function ema(window: readonly number[], period: number): number {
  const alpha = 2 / (period + 1);
  let value = mean(window.slice(0, period));
  for (let i = period; i < window.length; i++) value = alpha * window[i]! + (1 - alpha) * value;
  return value;
}

/** Wilder's RSI. Flat prices read as 50; no losses as 100. */
function rsi(window: readonly number[], period: number): number {
  const changes: number[] = [];
  for (let i = 1; i < window.length; i++) changes.push(window[i]! - window[i - 1]!);
  let avgGain = mean(changes.slice(0, period).map((c) => Math.max(c, 0)));
  let avgLoss = mean(changes.slice(0, period).map((c) => Math.max(-c, 0)));
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]!;
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** Largest peak-to-trough fall within the window, as a positive percent. */
function maxDrawdown(window: readonly number[]): number {
  let peak = window[0]!;
  let worst = 0;
  for (const close of window) {
    peak = Math.max(peak, close);
    worst = Math.max(worst, (peak - close) / peak);
  }
  return worst * 100;
}
