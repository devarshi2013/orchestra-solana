import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  industryOptions,
  sectorOptions,
  slug,
  withSectors,
  type BrowseCompany,
  type BrowseFilters,
} from "./browse";

const co = (
  ticker: string,
  sector: string,
  industry: string | null,
  o: Partial<BrowseCompany> = {},
): BrowseCompany => ({
  ticker,
  companyName: `${ticker} Inc`,
  type: "stock",
  sector,
  industry,
  liquidityTier: "high",
  issuers: [{ symbol: `${ticker}x` }],
  ...o,
});

const COMPANIES = [
  co("NVDA", "Technology", "Semiconductors", { companyName: "NVIDIA" }),
  co("AMD", "Technology", "Semiconductors", {
    liquidityTier: "medium",
    companyName: "Advanced Micro",
  }),
  co("MSFT", "Technology", "Prepackaged Software", { companyName: "Microsoft" }),
  co("JPM", "Financials", "Banks", { liquidityTier: "low", companyName: "JPMorgan" }),
  co("XLE", "Energy", "Oil ETF", { type: "etf", companyName: "Energy Select" }),
  co("XOM", "Energy", "Integrated Oil", { liquidityTier: "medium", companyName: "Exxon" }),
  co("SPY", "Diversified", null, { type: "etf", companyName: "S&P 500 ETF" }),
];
const f = (o: Partial<BrowseFilters>): BrowseFilters => ({ ...DEFAULT_FILTERS, ...o });
const tickers = (list: BrowseCompany[]) => list.map((c) => c.ticker);
const known = {
  sectors: [...new Set(COMPANIES.map((c) => c.sector))],
  industries: [...new Set(COMPANIES.flatMap((c) => c.industry ?? []))],
};

describe("applyFilters", () => {
  it("combines every filter (AND)", () => {
    // Default order: most liquid first (AMD is medium).
    expect(tickers(applyFilters(COMPANIES, f({ sectors: ["Technology"] })))).toEqual([
      "NVDA",
      "MSFT",
      "AMD",
    ]);
    expect(
      tickers(applyFilters(COMPANIES, f({ sectors: ["Technology"], liquidity: "high" }))),
    ).toEqual(["NVDA", "MSFT"]);
    expect(
      tickers(
        applyFilters(
          COMPANIES,
          f({
            sectors: ["Technology", "Energy"],
            industries: ["Semiconductors", "Integrated Oil"],
          }),
        ),
      ),
    ).toEqual(["NVDA", "AMD", "XOM"]);
    expect(tickers(applyFilters(COMPANIES, f({ type: "etf", liquidity: "medium" })))).toEqual([
      "XLE",
      "SPY",
    ]);
    expect(tickers(applyFilters(COMPANIES, f({ sectors: ["Energy"], type: "stock" })))).toEqual([
      "XOM",
    ]);
  });

  it("searches company name, ticker and token symbol, case-insensitively", () => {
    expect(tickers(applyFilters(COMPANIES, f({ search: "micro" })))).toEqual(["MSFT", "AMD"]);
    expect(tickers(applyFilters(COMPANIES, f({ search: "JPM" })))).toEqual(["JPM"]);
    expect(tickers(applyFilters(COMPANIES, f({ search: "nvdax" })))).toEqual(["NVDA"]);
    expect(applyFilters(COMPANIES, f({ search: "zzz", sectors: ["Energy"] }))).toEqual([]);
  });

  it("sorts by a figure (missing ones last) or by name, either way", () => {
    const metrics = {
      NVDA: { marketCap: 4e12, change24h: 1.2, return1y: 38 },
      MSFT: { marketCap: 3.8e12, change24h: -0.5, return1y: 21 },
      AMD: { marketCap: null, change24h: 3.1, return1y: null },
    };
    const tech = { sectors: ["Technology"] };
    expect(tickers(applyFilters(COMPANIES, f({ ...tech, sort: "mcap" }), metrics))).toEqual([
      "NVDA",
      "MSFT",
      "AMD",
    ]);
    expect(
      tickers(applyFilters(COMPANIES, f({ ...tech, sort: "mcap", dir: "asc" }), metrics)),
    ).toEqual(["MSFT", "NVDA", "AMD"]);
    expect(tickers(applyFilters(COMPANIES, f({ ...tech, sort: "change" }), metrics))).toEqual([
      "AMD",
      "NVDA",
      "MSFT",
    ]);
    expect(
      tickers(applyFilters(COMPANIES, f({ ...tech, sort: "name", dir: "asc" }), metrics)),
    ).toEqual(["AMD", "MSFT", "NVDA"]);
    expect(
      tickers(applyFilters(COMPANIES, f({ ...tech, sort: "name", dir: "desc" }), metrics)),
    ).toEqual(["NVDA", "MSFT", "AMD"]);
    // Default: most liquid first, registry order within a tier.
    expect(tickers(applyFilters(COMPANIES, f({ sectors: ["Energy", "Financials"] })))).toEqual([
      "XLE",
      "XOM",
      "JPM",
    ]);
  });
});

describe("sector and industry options", () => {
  it("lists standard sectors first, with counts that apply the other filters", () => {
    const options = sectorOptions(COMPANIES, f({ type: "etf" }));
    expect(options.map((o) => o.name)).toEqual([
      "Technology",
      "Financials",
      "Energy",
      "Diversified",
    ]);
    expect(options.find((o) => o.name === "Energy")!.count).toBe(1);
    expect(options.find((o) => o.name === "Technology")!.count).toBe(0);
    // The chosen sector doesn't shrink the other sectors' counts.
    expect(
      sectorOptions(COMPANIES, f({ sectors: ["Energy"] })).find((o) => o.name === "Technology")!
        .count,
    ).toBe(3);
  });

  it("offers industries only within the chosen sectors", () => {
    expect(industryOptions(COMPANIES, f({}))).toEqual([]);
    expect(industryOptions(COMPANIES, f({ sectors: ["Technology"] }))).toEqual([
      { name: "Prepackaged Software", count: 1 },
      { name: "Semiconductors", count: 2 },
    ]);
    expect(
      industryOptions(COMPANIES, f({ sectors: ["Technology", "Energy"] })).map((o) => o.name),
    ).toEqual(["Integrated Oil", "Oil ETF", "Prepackaged Software", "Semiconductors"]);
  });

  it("drops chosen industries outside the new sectors when sectors change", () => {
    const start = f({
      sectors: ["Technology", "Energy"],
      industries: ["Semiconductors", "Oil ETF"],
    });
    expect(withSectors(COMPANIES, start, ["Energy"])).toMatchObject({
      sectors: ["Energy"],
      industries: ["Oil ETF"],
    });
    expect(withSectors(COMPANIES, start, []).industries).toEqual([]);
  });
});

describe("URL state", () => {
  it("round-trips through the query string and restores on reload", () => {
    const filters = f({
      search: "oil",
      sectors: ["Consumer Discretionary", "Energy"].filter((s) => s !== "Consumer Discretionary"),
      industries: ["Integrated Oil"],
      type: "stock",
      liquidity: "medium",
      sort: "name",
      dir: "desc",
    });
    const params = filtersToParams(filters, new URLSearchParams("q=keep"));
    expect(params.toString()).toBe(
      "q=keep&find=oil&sector=energy&industry=integrated-oil&type=stock&liquidity=medium&sort=name&dir=desc",
    );
    expect(filtersFromParams(new URLSearchParams(params.toString()), known)).toEqual(filters);
  });

  it("leaves defaults out, and ignores unknown or invalid values", () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
    expect(filtersToParams(f({ sort: "mcap" })).toString()).toBe("sort=mcap");
    expect(
      filtersFromParams(
        new URLSearchParams("sector=technology,not-a-sector&type=bond&liquidity=x&sort=price"),
        known,
      ),
    ).toEqual(f({ sectors: ["Technology"] }));
    expect(slug("Consumer Discretionary")).toBe("consumer-discretionary");
  });
});

describe("Clear all", () => {
  it("counts active filters and a reset clears them all", () => {
    const busy = f({
      sort: "name",
      search: "oil",
      sectors: ["Energy"],
      industries: ["Oil ETF"],
      type: "etf",
      liquidity: "high",
    });
    expect(activeFilterCount(busy)).toBe(4);
    const cleared = DEFAULT_FILTERS;
    expect(activeFilterCount(cleared)).toBe(0);
    expect(applyFilters(COMPANIES, cleared)).toHaveLength(COMPANIES.length);
    expect(filtersToParams(cleared).toString()).toBe("");
  });
});
