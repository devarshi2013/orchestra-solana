import { ema, sma } from "./moving-averages";
import { cumulativeReturn, maxDrawdown, stdevReturns } from "./returns";
import { rsi } from "./rsi";
import type { IndicatorSpec } from "./types";

/** Fewest closes for which `spec` has a value; shorter histories yield null. */
export function barsRequired(spec: IndicatorSpec): number {
  switch (spec.fn) {
    case "price":
      return 1;
    case "sma":
    case "ema":
      return spec.period;
    case "rsi":
    case "cumulativeReturn":
    case "maxDrawdown":
    case "stdevReturn":
      return spec.period + 1;
  }
}

/** Value of `spec` at the latest of `closes` (oldest first), or null if history is too short. */
export function computeIndicator(spec: IndicatorSpec, closes: readonly number[]): number | null {
  switch (spec.fn) {
    case "price":
      return closes.length ? closes[closes.length - 1]! : null;
    case "sma":
      return sma(closes, spec.period);
    case "ema":
      return ema(closes, spec.period);
    case "rsi":
      return rsi(closes, spec.period);
    case "cumulativeReturn":
      return cumulativeReturn(closes, spec.period);
    case "maxDrawdown":
      return maxDrawdown(closes, spec.period);
    case "stdevReturn":
      return stdevReturns(closes, spec.period);
  }
}

const LABELS: Record<IndicatorSpec["fn"], string> = {
  price: "Price",
  sma: "SMA",
  ema: "EMA",
  rsi: "RSI",
  cumulativeReturn: "Cumulative return",
  maxDrawdown: "Max drawdown",
  stdevReturn: "Stdev of returns",
};

/** Human label, e.g. "SMA(50)". */
export function formatIndicator(spec: IndicatorSpec): string {
  return spec.fn === "price" ? LABELS.price : `${LABELS[spec.fn]}(${spec.period})`;
}
