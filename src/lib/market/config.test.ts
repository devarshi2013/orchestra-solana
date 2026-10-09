import { describe, expect, it } from "vitest";

import { STOCKS } from "@/lib/stocks/registry";

import { candleSecs, MARKET_TOKENS, WINDOWS } from "./config";

describe("MARKET_TOKENS", () => {
  it("uses only verified-registry stocks, with the registry's mint and ticker", () => {
    const stocks = MARKET_TOKENS.filter((t) => t.kind === "stock");
    expect(stocks.length).toBeGreaterThan(0);
    for (const token of stocks) {
      const entry = STOCKS.find((s) => s.symbol === token.symbol);
      expect(entry, token.symbol).toBeDefined();
      expect(token.mint).toBe(entry!.mint);
      expect(token.ticker).toBe(entry!.ticker);
    }
  });

  it("has a history pool for every token, no duplicates, and never charts USDC", () => {
    expect(MARKET_TOKENS.every((t) => t.pool)).toBe(true);
    expect(new Set(MARKET_TOKENS.map((t) => t.mint)).size).toBe(MARKET_TOKENS.length);
    expect(MARKET_TOKENS.map((t) => t.symbol)).not.toContain("USDC");
  });
});

describe("WINDOWS", () => {
  it("covers each window with its candles", () => {
    for (const w of Object.values(WINDOWS)) {
      expect(candleSecs(w) * w.limit).toBeGreaterThanOrEqual(w.secs);
    }
  });
});
