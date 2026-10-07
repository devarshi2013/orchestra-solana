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
const assets = [
  asset({ kind: "crypto", ticker: "SOL", symbol: "SOL", name: "Solana", mint: "sol" }),
  asset({ kind: "crypto", ticker: "WIF", symbol: "$WIF", name: "dogwifhat", mint: "wif" }),
  asset({
    kind: "crypto",
    ticker: "USDC",
    symbol: "USDC",
    name: "USD Coin",
    mint: "usdc",
    cash: true,
  }),
  asset({
    kind: "stock",
    ticker: "NVDA",
    symbol: "NVDAx",
    name: "NVIDIA",
    mint: "nvdax",
    issuer: "xstocks",
  }),
  asset({
    kind: "stock",
    ticker: "NVDA",
    symbol: "NVDAon",
    name: "NVIDIA",
    mint: "nvdaon",
    issuer: "ondo",
  }),
  asset({
    kind: "stock",
    ticker: "SPY",
    symbol: "SPYx",
    name: "SP500",
    mint: "spyx",
    issuer: "xstocks",
  }),
];
const plan = (
  items: { kind: "stock" | "crypto"; ticker: string; usdcAmount: number }[],
  total?: number,
) => ({
  items: items.map((i) => ({ ...i, reason: "because" })),
  totalUsdc: total ?? items.reduce((s, i) => s + i.usdcAmount, 0),
  rankingMethod: "best 1Y return with liquidity above $5M",
});

describe("validatePlan", () => {
  it("accepts a plan within budget, resolving tickers to registry tokens", () => {
    const result = validatePlan(
      plan([
        { kind: "crypto", ticker: "SOL", usdcAmount: 60 },
        { kind: "stock", ticker: "NVDAx", usdcAmount: 25 },
        { kind: "stock", ticker: "spy", usdcAmount: 15 },
        { kind: "crypto", ticker: "WIF", usdcAmount: 10 },
      ]),
      { assets, usdcBalance: 110 },
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.plan.items.map((i) => i.symbol)).toEqual([
      "SOL",
      "NVDAx",
      "SPYx",
      "$WIF",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/"mint"/);
  });

  it("explains every problem so the model can fix them", () => {
    const result = validatePlan(
      plan(
        [
          { kind: "crypto", ticker: "DOGE", usdcAmount: 20 },
          { kind: "stock", ticker: "NVDA", usdcAmount: 20 },
          { kind: "crypto", ticker: "USDC", usdcAmount: 20 },
          { kind: "crypto", ticker: "SOL", usdcAmount: 5 },
          { kind: "stock", ticker: "SOL", usdcAmount: 20 },
        ],
        70,
      ),
      { assets, usdcBalance: 50 },
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        `"DOGE" is not a crypto in the asset registry; use listAssets to pick one.`,
        `"NVDA" is ambiguous (NVDAx, NVDAon); use the token symbol.`,
        `"USDC" is USDC, which the plan spends; leave it out.`,
        `"SOL" is 5 USDC, below the 10 USDC minimum order size.`,
        `"SOL" is not a stock in the asset registry; use listAssets to pick one.`,
        "totalUsdc is 70 but the items add up to 85.",
        "totalUsdc 70 exceeds the wallet's 50 USDC.",
      ],
    });
  });

  it("rejects duplicates, malformed plans and an unreadable balance", () => {
    const dup = validatePlan(
      plan([
        { kind: "crypto", ticker: "SOL", usdcAmount: 10 },
        { kind: "crypto", ticker: "sol", usdcAmount: 10 },
      ]),
      { assets, usdcBalance: 100 },
    );
    expect(dup).toMatchObject({
      ok: false,
      errors: [`"sol" appears more than once; combine it into one item.`],
    });
    expect(validatePlan({ items: [], totalUsdc: 0 }, { assets, usdcBalance: 1 })).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("Malformed plan")],
    });
    expect(
      validatePlan(plan([{ kind: "crypto", ticker: "SOL", usdcAmount: 10 }]), {
        assets,
        usdcBalance: null,
      }),
    ).toMatchObject({ ok: false, errors: [expect.stringContaining("couldn't be read")] });
  });

  it("tolerates cent-level rounding in the total", () => {
    const result = validatePlan(
      plan(
        [
          { kind: "crypto", ticker: "SOL", usdcAmount: 33.33 },
          { kind: "crypto", ticker: "WIF", usdcAmount: 33.33 },
          { kind: "stock", ticker: "SPYx", usdcAmount: 33.34 },
        ],
        100.005,
      ),
      { assets, usdcBalance: 100.01 },
    );
    expect(result.ok).toBe(true);
  });
});
