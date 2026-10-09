import { describe, expect, it } from "vitest";

import type { Asset } from "@/lib/assets/registry";

import { validatePlan } from "./plan";

const asset = (o: Partial<Asset>): Asset => ({
  kind: "crypto",
  ticker: "X",
  name: "X",
  category: "Other",
  mint: o.symbol ?? "X",
  symbol: "X",
  decimals: 6,
  icon: null,
  liquidityUsd: null,
  volume24hUsd: null,
  ...o,
});
const stock = (ticker: string, symbol: string, issuer: "xstocks" | "ondo") =>
  asset({ kind: "stock", ticker, symbol, name: ticker, mint: symbol.toLowerCase(), issuer });
const assets = [
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
  it("accepts a stock plan within budget, resolving tickers to registry tokens", () => {
    const result = validatePlan(
      plan([
        { ticker: "NVDAx", usdcAmount: 60 },
        { ticker: "spy", usdcAmount: 25 },
        { ticker: "AAPL", usdcAmount: 15 },
      ]),
      { assets, usdcBalance: 110 },
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.items.map((i) => i.symbol)).toEqual(["NVDAx", "SPYx", "AAPLx"]);
    expect(JSON.stringify(result)).not.toMatch(/"mint"/);
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
      { assets, usdcBalance: 40 },
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        `"DOGE" is not a stock in the asset registry; use listAssets to pick one.`,
        `"NVDA" is ambiguous (NVDAx, NVDAon); use the token symbol.`,
        `"SPYx" is 5 USDC, below the 10 USDC minimum order size.`,
        "totalUsdc is 70 but the items add up to 45.",
        "totalUsdc 70 exceeds the wallet's 40 USDC.",
      ],
    });
  });

  it("rejects duplicates, crypto or malformed plans, and an unreadable balance", () => {
    const dup = validatePlan(
      plan([
        { ticker: "NVDAx", usdcAmount: 10 },
        { ticker: "nvdax", usdcAmount: 10 },
      ]),
      { assets, usdcBalance: 100 },
    );
    expect(dup).toMatchObject({
      ok: false,
      errors: [`"nvdax" appears more than once; combine it into one item.`],
    });
    expect(validatePlan({ items: [], totalUsdc: 0 }, { assets, usdcBalance: 1 })).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("Malformed plan")],
    });
    const crypto = {
      ...plan([{ ticker: "SOL", usdcAmount: 10 }]),
      items: [{ kind: "crypto", ticker: "SOL", usdcAmount: 10, reason: "because" }],
    };
    expect(validatePlan(crypto, { assets, usdcBalance: 100 })).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("Malformed plan")],
    });
    expect(
      validatePlan(plan([{ ticker: "NVDAx", usdcAmount: 10 }]), { assets, usdcBalance: null }),
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
      { assets, usdcBalance: 100.01 },
    );
    expect(result.ok).toBe(true);
  });
});
