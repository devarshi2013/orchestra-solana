import { describe, expect, it } from "vitest";

import { homeRows, sectorTiles, tapeRows } from "./home";
import type { MarketRow } from "./types";

const row = (ticker: string, o: Partial<MarketRow> = {}): MarketRow => ({
  ticker,
  name: ticker,
  category: "equity",
  sector: "Technology",
  preIpo: false,
  hours: "24/5",
  symbol: `${ticker}x`,
  issuer: "xStocks",
  mint: ticker,
  decimals: 8,
  chartMint: ticker,
  chartSymbol: `${ticker}x`,
  chartDecimals: 8,
  icon: null,
  price: 100,
  change24h: 0,
  marketCap: 1,
  volume24h: 1,
  liquidity: null,
  holders: null,
  ...o,
});

const STOCKS = [
  row("AAA", { marketCap: 30, change24h: 2 }),
  row("BBB", { marketCap: 20, change24h: -4 }),
  row("CCC", { marketCap: 10, change24h: null }),
  row("GLD", { category: "commodity", sector: "Materials", marketCap: 50, change24h: 1 }),
  row("SPY", { category: "etf", sector: "Diversified", marketCap: 40, change24h: null }),
  row("JPM", { sector: "Financials", marketCap: 5, change24h: 6, price: null }),
];
const CRYPTO = [
  row("SOL", { category: "crypto", marketCap: 9 }),
  row("RAY", { category: "crypto" }),
];
const tickers = (rows: MarketRow[]) => rows.map((r) => r.ticker);

describe("homeRows", () => {
  it("lists each tab's largest by market cap", () => {
    expect(tickers(homeRows(STOCKS, CRYPTO, "stocks", null, null))).toEqual([
      "AAA",
      "BBB",
      "CCC",
      "JPM",
    ]);
    expect(tickers(homeRows(STOCKS, CRYPTO, "etfs", null, null))).toEqual(["GLD", "SPY"]);
    expect(tickers(homeRows(STOCKS, CRYPTO, "crypto", null, null))).toEqual(["SOL", "RAY"]);
  });

  it("finds gainers and losers only among rows with a price and a change", () => {
    expect(tickers(homeRows(STOCKS, CRYPTO, "gainers", null, null))).toEqual(["AAA", "GLD"]);
    expect(tickers(homeRows(STOCKS, CRYPTO, "losers", null, null))).toEqual(["BBB"]);
  });

  it("filters by sector and applies a column sort", () => {
    expect(tickers(homeRows(STOCKS, CRYPTO, "stocks", "Financials", null))).toEqual(["JPM"]);
    expect(
      tickers(homeRows(STOCKS, CRYPTO, "stocks", null, { key: "change", dir: "asc" })),
    ).toEqual(["BBB", "AAA", "JPM", "CCC"]);
  });

  it("shows at most 10 rows", () => {
    const many = Array.from({ length: 25 }, (_, i) => row(`T${i}`, { marketCap: i }));
    expect(homeRows(many, [], "stocks", null, null)).toHaveLength(10);
  });
});

describe("sectorTiles", () => {
  it("averages the real 24h changes and counts what was included", () => {
    const tiles = sectorTiles(STOCKS);
    expect(tiles[0]).toEqual({ sector: "Technology", change: -1, counted: 2, total: 3 });
    expect(tiles.find((t) => t.sector === "Diversified")).toMatchObject({
      change: null,
      counted: 0,
    });
  });
});

it("builds the tape from the largest priced stocks, then SOL and JUP", () => {
  expect(tickers(tapeRows(STOCKS, CRYPTO))).toEqual(["GLD", "SPY", "AAA", "BBB", "CCC", "SOL"]);
});
