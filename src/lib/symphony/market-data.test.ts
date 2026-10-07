import { describe, expect, it } from "vitest";

import { barIndexAt, closesWindow, InsufficientDataError, type MarketData } from "./market-data";

const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];

describe("barIndexAt", () => {
  it.each([
    ["2025-12-31", -1],
    ["2026-01-01", 0],
    ["2026-01-02T12:00", 1],
    ["2026-01-03", 2],
    ["2027-01-01", 2],
  ])("%s → %i", (date, index) => {
    expect(barIndexAt(dates, date)).toBe(index);
  });

  it("is -1 without data", () => {
    expect(barIndexAt([], "2026-01-01")).toBe(-1);
  });
});

describe("closesWindow", () => {
  const data: MarketData = {
    dates,
    closes: { A: [1, 2, 3], B: [null, 2, 3], C: [0, 2, 3], D: [Number.NaN, 2, 3] },
  };

  it("returns the window ending at the index, oldest first", () => {
    expect(closesWindow(data, "A", 2, 2, "d")).toEqual([2, 3]);
    expect(closesWindow(data, "B", 2, 2, "d")).toEqual([2, 3]);
  });

  it.each([
    ["an unknown mint", "Z", 2, 1],
    ["too few bars", "A", 2, 4],
    ["a null close", "B", 2, 3],
    ["a zero close", "C", 2, 3],
    ["a NaN close", "D", 2, 3],
  ])("throws on %s", (_, mint, end, bars) => {
    expect(() => closesWindow(data, mint, end, bars, "d")).toThrow(InsufficientDataError);
  });
});
