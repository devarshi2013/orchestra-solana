import { describe, expect, it } from "vitest";

import { validateSymphony } from "@/lib/symphony/validate";

import { keepBalancedSymphony, keepBalancedWeights } from "./keep-balanced";

const item = (symbol: string, usdcAmount: number, status = "succeeded") => ({
  symbol,
  usdcAmount,
  status,
  mint: `${symbol}Mint`,
});

describe("keepBalancedWeights", () => {
  it("uses the plan's amounts of the items that were bought", () => {
    expect(keepBalancedWeights([item("NVDAx", 30), item("SOL", 20)])).toEqual([
      { symbol: "NVDAx", percent: 60 },
      { symbol: "SOL", percent: 40 },
    ]);
    // A failed item isn't held; the rest are re-weighted among themselves.
    expect(
      keepBalancedWeights([item("NVDAx", 30), item("SOL", 20, "failed"), item("JUP", 10)]),
    ).toEqual([
      { symbol: "NVDAx", percent: 75 },
      { symbol: "JUP", percent: 25 },
    ]);
  });

  it("rounds to hundredths that sum to exactly 100", () => {
    const weights = keepBalancedWeights([item("A", 10), item("B", 10), item("C", 10)]);
    expect(weights.map((w) => w.percent)).toEqual([33.34, 33.33, 33.33]);
    const odd = keepBalancedWeights([item("A", 13.37), item("B", 21.5), item("C", 47.11)]);
    expect(Math.round(odd.reduce((s, w) => s + w.percent, 0) * 100)).toBe(10_000);
  });

  it("is empty when nothing was bought", () => {
    expect(keepBalancedWeights([item("A", 10, "failed"), item("B", 10, "pending")])).toEqual([]);
  });
});

describe("keepBalancedSymphony", () => {
  it("builds a valid specified-weight symphony with the bought mints", () => {
    const symphony = keepBalancedSymphony("My plan", [item("NVDAx", 30), item("SOL", 20)])!;
    expect(symphony.root).toEqual({
      type: "group",
      name: "Plan weights",
      weight: { method: "specified", percentages: [60, 40] },
      children: [
        { type: "asset", mint: "NVDAxMint" },
        { type: "asset", mint: "SOLMint" },
      ],
    });
    expect(validateSymphony(symphony, { isKnownMint: () => true })).toEqual([]);
    expect(keepBalancedSymphony("x", [item("A", 10, "failed")])).toBeNull();
  });
});
