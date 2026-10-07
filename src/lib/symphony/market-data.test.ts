import { describe, expect, it } from "vitest";

import { barIndexAt, historyAt, type MarketData } from "./market-data";

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

describe("historyAt", () => {
  const data: MarketData = {
    dates: [...dates, "2026-01-04"],
    closes: {
      A: [1, 2, 3, 4],
      B: [null, 2, 3, 4],
      C: [1, 0, 3, 4],
      D: [1, 2, Number.NaN, 4],
    },
  };

  it("returns the unbroken run of usable closes ending at the index", () => {
    expect(historyAt(data, "A", 2)).toEqual([1, 2, 3]);
    expect(historyAt(data, "B", 3)).toEqual([2, 3, 4]);
    expect(historyAt(data, "C", 3)).toEqual([3, 4]);
    expect(historyAt(data, "D", 3)).toEqual([4]);
  });

  it("is empty for unknown mints, unusable bars and dates before the data", () => {
    expect(historyAt(data, "Z", 3)).toEqual([]);
    expect(historyAt(data, "D", 2)).toEqual([]);
    expect(historyAt(data, "A", -1)).toEqual([]);
  });
});
