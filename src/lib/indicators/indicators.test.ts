import { describe, expect, it } from "vitest";

import { barsRequired, computeIndicator, formatIndicator } from "./compute";
import { ema, sma } from "./moving-averages";
import { cumulativeReturn, maxDrawdown, populationStdev, stdevReturns } from "./returns";
import { rsi } from "./rsi";
import type { IndicatorSpec } from "./types";

/** Published values are rounded to 2 decimals. */
const expectClose = (actual: number | null, expected: number) => {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual! - expected)).toBeLessThan(0.01);
};

/**
 * StockCharts ChartSchool "Moving Averages – Simple and Exponential" worked
 * example: 30 closes, 10-day SMA and EMA from bar 10 on.
 */
const MA_CLOSES = [
  22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15, 22.39, 22.38, 22.61,
  23.36, 24.05, 23.75, 23.83, 23.95, 23.63, 23.82, 23.87, 23.65, 23.19, 23.1, 23.33, 22.68, 23.1,
  22.4, 22.17,
];
const SMA_10 = [
  22.22, 22.21, 22.23, 22.26, 22.31, 22.42, 22.61, 22.77, 22.91, 23.08, 23.21, 23.38, 23.53, 23.65,
  23.71, 23.69, 23.61, 23.51, 23.43, 23.28, 23.13,
];
const EMA_10 = [
  22.22, 22.21, 22.24, 22.27, 22.33, 22.52, 22.8, 22.97, 23.13, 23.28, 23.34, 23.43, 23.51, 23.54,
  23.47, 23.4, 23.39, 23.26, 23.23, 23.08, 22.92,
];

/** StockCharts ChartSchool "RSI" worked example (cs-rsi.xls): 14-day Wilder RSI from bar 15 on. */
const RSI_CLOSES = [
  44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931,
  46.0328, 45.614, 46.282, 46.282, 46.0028, 46.0328, 46.4116, 46.2222, 45.6439, 46.2122, 46.2521,
  45.7137, 46.4515, 45.7835, 45.3548, 44.0288, 44.1783, 44.2181, 44.5672, 43.4205, 42.6628, 43.1314,
];
const RSI_14 = [
  70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38, 54.71, 50.42, 39.99, 41.46,
  41.87, 45.46, 37.3, 33.08, 37.77,
];

describe("sma", () => {
  it("matches the StockCharts 10-day example", () => {
    SMA_10.forEach((expected, i) => expectClose(sma(MA_CLOSES.slice(0, 10 + i), 10), expected));
  });

  it("is null with fewer closes than the period", () => {
    expect(sma(MA_CLOSES.slice(0, 9), 10)).toBeNull();
  });
});

describe("ema", () => {
  it("matches the StockCharts 10-day example", () => {
    EMA_10.forEach((expected, i) => expectClose(ema(MA_CLOSES.slice(0, 10 + i), 10), expected));
  });

  it("is null with fewer closes than the period", () => {
    expect(ema(MA_CLOSES.slice(0, 9), 10)).toBeNull();
  });
});

describe("rsi", () => {
  it("matches the StockCharts 14-day Wilder example", () => {
    RSI_14.forEach((expected, i) => expectClose(rsi(RSI_CLOSES.slice(0, 15 + i), 14), expected));
  });

  it("is null without period + 1 closes", () => {
    expect(rsi(RSI_CLOSES.slice(0, 14), 14)).toBeNull();
  });

  it("reads 100 with no losses and 50 when flat", () => {
    expect(rsi([1, 2, 3, 4], 2)).toBe(100);
    expect(rsi([3, 3, 3, 3], 2)).toBe(50);
  });
});

describe("return-based indicators", () => {
  it("cumulative return compares the latest close with `period` bars ago", () => {
    expect(cumulativeReturn([100, 50, 110, 120], 2)).toBe(140);
    expect(cumulativeReturn([50, 110], 2)).toBeNull();
  });

  it("max drawdown is the worst peak-to-trough fall", () => {
    expect(maxDrawdown([100, 120, 90, 110], 3)).toBe(25);
    expect(maxDrawdown([100, 80, 120, 108], 3)).toBe(20);
    expect(maxDrawdown([1, 2, 3], 2)).toBe(0);
    expect(maxDrawdown([1, 2], 2)).toBeNull();
  });

  it("population stdev of the textbook series is 2", () => {
    expect(populationStdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it("stdev of returns alternating ±10% is 10%", () => {
    expect(stdevReturns([100, 110, 99, 108.9, 98.01], 4)).toBeCloseTo(10, 10);
    expect(stdevReturns([100, 110], 2)).toBeNull();
  });
});

describe("computeIndicator", () => {
  it.each([
    [{ fn: "price" }, 1],
    [{ fn: "sma", period: 50 }, 50],
    [{ fn: "ema", period: 20 }, 20],
    [{ fn: "rsi", period: 14 }, 15],
    [{ fn: "cumulativeReturn", period: 30 }, 31],
    [{ fn: "maxDrawdown", period: 30 }, 31],
    [{ fn: "stdevReturn", period: 30 }, 31],
  ] satisfies [IndicatorSpec, number][])(
    "%o has a value from %i bars, not before",
    (spec, bars) => {
      const closes = Array.from({ length: bars }, (_, i) => 100 + (i % 3));
      expect(barsRequired(spec)).toBe(bars);
      expect(computeIndicator(spec, closes)).not.toBeNull();
      expect(computeIndicator(spec, closes.slice(1))).toBeNull();
    },
  );

  it("dispatches to the matching function", () => {
    expect(computeIndicator({ fn: "price" }, [1, 2, 7])).toBe(7);
    expectClose(computeIndicator({ fn: "ema", period: 10 }, MA_CLOSES), 22.92);
    expectClose(computeIndicator({ fn: "rsi", period: 14 }, RSI_CLOSES), 37.77);
  });

  it.each([
    [{ fn: "price" }, "Price"],
    [{ fn: "sma", period: 50 }, "SMA(50)"],
    [{ fn: "stdevReturn", period: 30 }, "Stdev of returns(30)"],
  ] satisfies [IndicatorSpec, string][])("formats %o as %s", (spec, label) => {
    expect(formatIndicator(spec)).toBe(label);
  });
});
