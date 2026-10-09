import { describe, expect, it } from "vitest";

import { companies, listStocks, normalizeSector, resolveTicker } from "./registry";
import type { StockEntry } from "./types";

const entry = (o: Partial<StockEntry> & Pick<StockEntry, "ticker" | "symbol">): StockEntry => ({
  companyName: o.ticker,
  type: "stock",
  sector: "Technology",
  industry: null,
  mint: `${o.symbol}-mint`,
  issuer: "xstocks",
  liquidityTier: "high",
  decimals: 8,
  hours: "24/5",
  preIpo: false,
  sectorSource: "nasdaq",
  testImpactPct: 0.05,
  ...o,
});
const stocks = [
  entry({ ticker: "NVDA", symbol: "NVDAx", industry: "Semiconductors" }),
  entry({ ticker: "NVDA", symbol: "NVDAon", issuer: "ondo", liquidityTier: "medium" }),
  entry({
    ticker: "JPM",
    symbol: "JPMx",
    sector: "Financials",
    industry: "Major Banks",
    liquidityTier: "low",
  }),
  entry({
    ticker: "XOM",
    symbol: "XOMon",
    issuer: "ondo",
    sector: "Energy",
    liquidityTier: "medium",
  }),
  entry({ ticker: "XLE", symbol: "XLEon", issuer: "ondo", type: "etf", sector: "Energy" }),
];

describe("listStocks", () => {
  it("filters by sector, accepting everyday aliases", () => {
    expect(listStocks({ sector: "Energy" }, stocks).map((c) => c.ticker)).toEqual(["XLE", "XOM"]);
    expect(listStocks({ sector: "banks" }, stocks).map((c) => c.ticker)).toEqual(["JPM"]);
    expect(listStocks({ sector: "tech" }, stocks).map((c) => c.ticker)).toEqual(["NVDA"]);
    expect(listStocks({ sector: "not a sector" }, stocks)).toEqual([]);
  });

  it("filters by type, industry, search and minimum liquidity", () => {
    expect(listStocks({ sector: "energy", type: "etf" }, stocks).map((c) => c.ticker)).toEqual([
      "XLE",
    ]);
    expect(listStocks({ industry: "semi" }, stocks).map((c) => c.ticker)).toEqual(["NVDA"]);
    expect(listStocks({ search: "nvdaon" }, stocks).map((c) => c.ticker)).toEqual(["NVDA"]);
    expect(listStocks({ minLiquidity: "medium" }, stocks).map((c) => c.ticker)).toEqual([
      "NVDA",
      "XLE",
      "XOM",
    ]);
  });

  it("groups a company's issuers, most liquid first", () => {
    const [nvda] = companies(stocks);
    expect(nvda!.issuers.map((i) => i.symbol)).toEqual(["NVDAx", "NVDAon"]);
    expect(nvda!.liquidityTier).toBe("high");
  });
});

describe("resolveTicker", () => {
  it("returns every issuer for a ticker and one for a token symbol", () => {
    expect(resolveTicker("nvda", stocks)).toMatchObject({ ok: true, ticker: "NVDA" });
    expect((resolveTicker("NVDA", stocks) as { candidates: unknown[] }).candidates).toHaveLength(2);
    expect(
      (resolveTicker("NVDAon", stocks) as { candidates: StockEntry[] }).candidates.map(
        (c) => c.symbol,
      ),
    ).toEqual(["NVDAon"]);
    expect(resolveTicker("ZZZZ", stocks)).toMatchObject({ ok: false });
  });

  it("knows the standard sectors", () => {
    expect(normalizeSector("Health Care")).toBe("Health Care");
    expect(normalizeSector("healthcare")).toBe("Health Care");
    expect(normalizeSector("crypto")).toBeNull();
  });
});
