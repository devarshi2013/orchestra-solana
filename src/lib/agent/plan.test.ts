import { describe, expect, it } from "vitest";

import type { StockEntry } from "@/lib/stocks/types";

import { validatePlan } from "./plan";

const stock = (ticker: string, symbol: string, issuer: StockEntry["issuer"]): StockEntry => ({
  ticker,
  companyName: ticker,
  type: "stock",
  sector: "Technology",
  industry: null,
  mint: `${symbol.toLowerCase()}-mint`,
  issuer,
  liquidityTier: "high",
  symbol,
  decimals: 8,
  hours: "24/5",
  preIpo: false,
  sectorSource: "nasdaq",
  testImpactPct: 0.05,
});
const stocks = [
  stock("NVDA", "NVDAx", "xstocks"),
  stock("NVDA", "NVDAon", "ondo"),
  stock("SPY", "SPYx", "xstocks"),
  stock("AAPL", "AAPLx", "xstocks"),
];
const plan = (items: { ticker: string; usdcAmount: number }[], total?: number) => ({
  items: items.map((i) => ({ kind: "stock", ...i, reason: "because" })),
  totalUsdc: total ?? items.reduce((s, i) => s + i.usdcAmount, 0),
  rankingMethod: "largest US tech by market cap",
});

describe("validatePlan", () => {
  it("accepts a plan within budget: a ticker leaves the issuer to the buy, a token symbol pins it", () => {
    const result = validatePlan(
      plan([
        { ticker: "NVDAx", usdcAmount: 60 },
        { ticker: "spy", usdcAmount: 25 },
        { ticker: "AAPL", usdcAmount: 15 },
      ]),
      { stocks, usdcBalance: 110 },
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.items.map((i) => [i.ticker, i.symbol])).toEqual([
      ["NVDA", "NVDAx"],
      ["SPY", "SPY"],
      ["AAPL", "AAPL"],
    ]);
    expect(JSON.stringify(result)).not.toMatch(/mint/);
  });

  it("rejects a ticker that isn't in the registry", () => {
    const result = validatePlan(plan([{ ticker: "ZZZZ", usdcAmount: 20 }]), {
      stocks,
      usdcBalance: 100,
    });
    expect(result).toEqual({
      ok: false,
      errors: [`"ZZZZ" isn't in Orchestra's stock registry; use listStocks to find one.`],
    });
  });

  it("explains every problem so the model can fix them", () => {
    const result = validatePlan(
      plan(
        [
          { ticker: "DOGE", usdcAmount: 20 },
          { ticker: "NVDA", usdcAmount: 20 },
          { ticker: "SPYx", usdcAmount: 5 },
        ],
        70,
      ),
      { stocks, usdcBalance: 40 },
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        `"DOGE" isn't in Orchestra's stock registry; use listStocks to find one.`,
        `"SPYx" is 5 USDC, below the 10 USDC minimum order size.`,
        "totalUsdc is 70 but the items add up to 45.",
        "totalUsdc 70 exceeds the wallet's 40 USDC.",
      ],
    });
  });

  it("rejects the same company twice, malformed plans, and an unreadable balance", () => {
    const dup = validatePlan(
      plan([
        { ticker: "NVDAx", usdcAmount: 10 },
        { ticker: "NVDAon", usdcAmount: 10 },
      ]),
      { stocks, usdcBalance: 100 },
    );
    expect(dup).toMatchObject({
      ok: false,
      errors: [`"NVDAon" appears more than once; combine it into one item.`],
    });
    expect(validatePlan({ items: [], totalUsdc: 0 }, { stocks, usdcBalance: 1 })).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("Malformed plan")],
    });
    const crypto = {
      ...plan([{ ticker: "SOL", usdcAmount: 10 }]),
      items: [{ kind: "crypto", ticker: "SOL", usdcAmount: 10, reason: "because" }],
    };
    expect(validatePlan(crypto, { stocks, usdcBalance: 100 })).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("Malformed plan")],
    });
    expect(
      validatePlan(plan([{ ticker: "NVDAx", usdcAmount: 10 }]), { stocks, usdcBalance: null }),
    ).toMatchObject({ ok: false, errors: [expect.stringContaining("couldn't be read")] });
  });

  it("tolerates cent-level rounding in the total", () => {
    const result = validatePlan(
      plan(
        [
          { ticker: "NVDAx", usdcAmount: 33.33 },
          { ticker: "AAPLx", usdcAmount: 33.33 },
          { ticker: "SPYx", usdcAmount: 33.34 },
        ],
        100.005,
      ),
      { stocks, usdcBalance: 100.01 },
    );
    expect(result.ok).toBe(true);
  });
});
