/**
 * A technical indicator over one price series. Periods count bars (days for
 * daily candles). Units: price and SMA/EMA in the series' price; RSI 0–100;
 * cumulative return, max drawdown and stdev of returns in percent (10 = 10%).
 */
export type IndicatorSpec =
  | { fn: "price" }
  | { fn: "sma"; period: number }
  | { fn: "ema"; period: number }
  | { fn: "rsi"; period: number }
  | { fn: "cumulativeReturn"; period: number }
  | { fn: "maxDrawdown"; period: number }
  | { fn: "stdevReturn"; period: number };

export type IndicatorFn = IndicatorSpec["fn"];
