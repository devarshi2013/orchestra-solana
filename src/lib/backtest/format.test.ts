import { describe, expect, it } from "vitest";

import { formatDay, formatPercent, formatRatio, formatUsd, niceTicks } from "./format";

describe("backtest formatting", () => {
  it("formats percents, ratios and money", () => {
    expect(formatPercent(-0.118)).toBe("-11.8%");
    expect(formatPercent(null)).toBe("—");
    expect(formatRatio(1.234)).toBe("1.23");
    expect(formatRatio(Number.NaN)).toBe("—");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(1234.5, true)).toBe("$1.2K");
  });

  it("formats days in UTC", () => {
    expect(formatDay("2026-03-02")).toBe("Mar 2");
  });

  it("picks round ticks across the range", () => {
    expect(niceTicks(882, 1102.5)).toEqual([900, 1000, 1100]);
    expect(niceTicks(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});
