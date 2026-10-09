import { describe, expect, it } from "vitest";

import {
  appendTick,
  chartPoints,
  closedCandles,
  formatCompactUsd,
  formatPct,
  formatPrice,
  liveCandle,
  MAX_TICKS,
  windowChangePct,
  type Candle,
} from "./series";

const candle = (time: number, close: number): Candle => ({
  time,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
});

describe("appendTick", () => {
  it("adds newer ticks only and keeps at most MAX_TICKS", () => {
    let ticks = appendTick([], { time: 10, value: 1 });
    ticks = appendTick(ticks, { time: 10, value: 2 });
    ticks = appendTick(ticks, { time: 18, value: 3 });
    expect(ticks).toEqual([
      { time: 10, value: 1 },
      { time: 18, value: 3 },
    ]);
    let many: { time: number; value: number }[] = [];
    for (let i = 0; i < MAX_TICKS + 5; i++) many = appendTick(many, { time: i, value: i });
    expect(many).toHaveLength(MAX_TICKS);
    expect(many[0]!.time).toBe(5);
  });
});

describe("chartPoints", () => {
  it("joins history closes with the live ticks after them, within the window", () => {
    const candles = [candle(0, 100), candle(900, 101), candle(1800, 102)];
    const ticks = [
      { time: 1700, value: 99 }, // older than the last candle: dropped
      { time: 1900, value: 103 },
    ];
    expect(chartPoints(candles, ticks, 10_000).map((p) => p.value)).toEqual([100, 101, 102, 103]);
    expect(chartPoints(candles, ticks, 1_000).map((p) => p.time)).toEqual([900, 1800, 1900]);
    expect(chartPoints([], [], 3600)).toEqual([]);
    expect(chartPoints([], ticks, 3600)).toEqual(ticks);
  });

  it("reports the change across the visible points", () => {
    expect(
      windowChangePct([
        { time: 0, value: 100 },
        { time: 1, value: 110 },
      ]),
    ).toBeCloseTo(10);
    expect(windowChangePct([])).toBeNull();
  });
});

describe("liveCandle / closedCandles", () => {
  const width = 900;
  const candles = [candle(0, 100), candle(900, 105)];

  it("continues the current bucket's candle with the live price", () => {
    expect(liveCandle(candles, width, 107, 1000)).toEqual({
      time: 900,
      open: 105,
      high: 107,
      low: 104,
      close: 107,
    });
    expect(closedCandles(candles, width, 1000)).toEqual([candles[0]]);
  });

  it("opens a new candle at the last close when the bucket has moved on", () => {
    expect(liveCandle(candles, width, 103, 1900)).toEqual({
      time: 1800,
      open: 105,
      high: 105,
      low: 103,
      close: 103,
    });
    expect(liveCandle([], width, null, 1900)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats prices, compact USD and signed percentages", () => {
    expect(formatPrice(108.8556)).toBe("$108.86");
    expect(formatPrice(0.37061)).toBe("$0.3706");
    expect(formatPrice(1234.5)).toBe("$1,234.50");
    expect(formatCompactUsd(64_123_911_352)).toBe("$64.12B");
    expect(formatCompactUsd(null)).toBe("—");
    expect(formatPct(1.234)).toBe("+1.23%");
    expect(formatPct(-0.9)).toBe("−0.90%");
    expect(formatPct(null)).toBe("—");
  });
});
