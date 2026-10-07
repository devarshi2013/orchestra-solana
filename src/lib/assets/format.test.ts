import { describe, expect, it } from "vitest";

import { formatChange, formatPrice, looksThin } from "./format";

describe("asset formatting", () => {
  it.each([
    [123.456, "$123.46"],
    [1, "$1.00"],
    [0.3202599, "$0.3203"],
    [0.0000123456, "$0.00001235"],
    [null, "—"],
  ])("price %s → %s", (usd, text) => {
    expect(formatPrice(usd)).toBe(text);
  });

  it("formats 24h change with a sign", () => {
    expect(formatChange(1.294)).toBe("+1.29%");
    expect(formatChange(-0.5)).toBe("-0.50%");
    expect(formatChange(null)).toBe("—");
  });

  it("flags thin assets only when both liquidity and volume are low", () => {
    expect(looksThin({ liquidityUsd: 3_000, volume24hUsd: 3_900_000 })).toBe(false);
    expect(looksThin({ liquidityUsd: 3_000, volume24hUsd: 1_000 })).toBe(true);
    expect(looksThin({ liquidityUsd: null, volume24hUsd: null })).toBe(true);
  });
});
