import { describe, expect, it } from "vitest";

import {
  candleOpenAt,
  isClosed,
  planWindows,
  toDateKey,
  toMarketData,
  type Candle,
  type CandleInterval,
} from "./candles";

const DAY = 86_400;
const JAN_1 = Date.UTC(2026, 0, 1) / 1000;

const candle = (
  mint: string,
  openTime: number,
  close: number,
  interval: CandleInterval = "1D",
): Candle => ({
  mint,
  interval,
  openTime,
  open: close,
  high: close,
  low: close,
  close,
  volume: 0,
  volumeUsd: null,
});

describe("candle time helpers", () => {
  it("floors to the containing candle", () => {
    expect(candleOpenAt(JAN_1 + 5 * 3600 + 59, "1D")).toBe(JAN_1);
    expect(candleOpenAt(JAN_1 + 5 * 3600 + 59, "1H")).toBe(JAN_1 + 5 * 3600);
  });

  it("treats a candle as closed only once its full width has passed", () => {
    expect(isClosed(JAN_1, "1D", JAN_1 + DAY - 1)).toBe(false);
    expect(isClosed(JAN_1, "1D", JAN_1 + DAY)).toBe(true);
    expect(isClosed(JAN_1, "1H", JAN_1 + 3600)).toBe(true);
  });

  it("formats daily keys in UTC", () => {
    expect(toDateKey(JAN_1)).toBe("2026-01-01");
  });
});

describe("planWindows", () => {
  it("splits a range into windows of at most N candles", () => {
    expect(planWindows(JAN_1, JAN_1 + 4 * DAY, "1D", 2)).toEqual([
      { from: JAN_1, to: JAN_1 + DAY },
      { from: JAN_1 + 2 * DAY, to: JAN_1 + 3 * DAY },
      { from: JAN_1 + 4 * DAY, to: JAN_1 + 4 * DAY },
    ]);
  });

  it("returns one window when it fits and none for an empty range", () => {
    expect(planWindows(JAN_1, JAN_1 + 23 * 3600, "1H", 5000)).toEqual([
      { from: JAN_1, to: JAN_1 + 23 * 3600 },
    ]);
    expect(planWindows(JAN_1 + DAY, JAN_1, "1D", 10)).toEqual([]);
  });
});

describe("toMarketData", () => {
  it("aligns daily closes on a gap-free UTC date axis", () => {
    const data = toMarketData(
      [
        candle("SOL", JAN_1, 100),
        candle("SOL", JAN_1 + DAY, 101),
        candle("SOL", JAN_1 + 3 * DAY, 103), // day 3 missing
        candle("NEW", JAN_1 + 2 * DAY, 5), // listed on day 3
        candle("SOL", JAN_1 + 2 * DAY + 3600, 999, "1H"), // hourly rows are ignored
        candle("OTHER", JAN_1, 1), // not requested
      ],
      ["SOL", "NEW", "EMPTY"],
    );
    expect(data).toEqual({
      dates: ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"],
      closes: {
        SOL: [100, 101, null, 103],
        NEW: [null, null, 5, null],
        EMPTY: [null, null, null, null],
      },
    });
  });

  it("is empty without daily candles", () => {
    expect(toMarketData([], ["SOL"])).toEqual({ dates: [], closes: { SOL: [] } });
  });
});
