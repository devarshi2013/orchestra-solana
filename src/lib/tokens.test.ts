import { describe, expect, it } from "vitest";

import { isLowLiquidity, rankTokens, type TokenInfo } from "./tokens";

const token = (symbol: string, isVerified: boolean, liquidity: number | null): TokenInfo => ({
  mint: symbol,
  symbol,
  name: symbol,
  decimals: 6,
  icon: null,
  isVerified,
  isSus: false,
  liquidity,
});

describe("rankTokens", () => {
  it("puts verified tokens first, then an exact symbol match, else API order", () => {
    const ranked = rankTokens(
      [
        token("BONKCAT", false, 9e9),
        token("bonkSOL", true, 11e6),
        token("Bonk", true, 6e6),
        token("BERN", true, 2e5),
      ],
      "BONK",
    );
    expect(ranked.map((t) => t.symbol)).toEqual(["Bonk", "bonkSOL", "BERN", "BONKCAT"]);
  });

  it("keeps API order without a query", () => {
    const ranked = rankTokens([
      token("A", false, null),
      token("B", true, null),
      token("C", true, 1),
    ]);
    expect(ranked.map((t) => t.symbol)).toEqual(["B", "C", "A"]);
  });
});

describe("isLowLiquidity", () => {
  it("flags known liquidity under $50k only", () => {
    expect(isLowLiquidity({ liquidity: 49_999 })).toBe(true);
    expect(isLowLiquidity({ liquidity: 50_000 })).toBe(false);
    expect(isLowLiquidity({ liquidity: null })).toBe(false);
  });
});
