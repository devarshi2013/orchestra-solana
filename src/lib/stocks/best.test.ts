import { describe, expect, it } from "vitest";

import { pickBest, totalCostPct, type CandidateQuote } from "./best";

const q = (o: Partial<CandidateQuote>): CandidateQuote => ({
  symbol: "X",
  liquidityTier: "high",
  priceImpactPct: 0.1,
  feeBps: 0,
  buildable: true,
  ...o,
});

describe("pickBest", () => {
  it("picks the issuer with the lower total cost (price impact + fee)", () => {
    const quotes = [
      q({ symbol: "NVDAx", priceImpactPct: -0.4, feeBps: 10 }), // 0.5%
      q({ symbol: "NVDAon", priceImpactPct: -0.05, feeBps: 5 }), // 0.1%
    ];
    expect(pickBest(quotes)).toBe(1);
    expect(totalCostPct(quotes[0]!)).toBeCloseTo(0.5);
  });

  it("skips unbuildable or unpriced quotes, and breaks ties on liquidity", () => {
    expect(
      pickBest([
        q({ symbol: "A", priceImpactPct: 0.01, buildable: false }),
        q({ symbol: "B", priceImpactPct: null }),
        q({ symbol: "C", priceImpactPct: 0.3 }),
      ]),
    ).toBe(2);
    expect(
      pickBest([
        q({ symbol: "A", liquidityTier: "medium" }),
        q({ symbol: "B", liquidityTier: "high" }),
      ]),
    ).toBe(1);
    expect(pickBest([q({ buildable: false })])).toBe(-1);
  });
});
