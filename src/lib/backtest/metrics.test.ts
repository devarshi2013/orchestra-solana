import { describe, expect, it } from "vitest";

import { computeMetrics, maxDrawdown } from "./metrics";

describe("computeMetrics", () => {
  it("matches a hand calculation", () => {
    // Daily returns: +5%, +5%, 0%, −20%. Mean −2.5%.
    const metrics = computeMetrics([1000, 1050, 1102.5, 1102.5, 882]);
    // Sample stdev: √((0.075² + 0.075² + 0.025² + 0.175²) / 3) = √(0.0425 / 3)
    const stdev = Math.sqrt(0.0425 / 3);
    // Downside deviation: √(0.2² / 4) = 0.1
    const root365 = Math.sqrt(365);
    expect(metrics.totalReturn).toBeCloseTo(-0.118, 12);
    expect(metrics.cagr).toBeCloseTo(0.882 ** (365 / 4) - 1, 12);
    expect(metrics.maxDrawdown).toBeCloseTo(0.2, 12); // 1102.5 → 882
    expect(metrics.volatility).toBeCloseTo(stdev * root365, 12);
    expect(metrics.sharpe).toBeCloseTo((-0.025 / stdev) * root365, 12);
    expect(metrics.sortino).toBeCloseTo((-0.025 / 0.1) * root365, 12);
    expect(metrics.winRate).toBe(0.5);
  });

  it("leaves ratios undefined when they can't be computed", () => {
    expect(computeMetrics([100, 110])).toMatchObject({
      totalReturn: expect.closeTo(0.1, 12),
      volatility: null,
      sharpe: null,
      sortino: null,
      winRate: 1,
    });
    // Flat: zero deviation, no downside.
    expect(computeMetrics([100, 100, 100])).toMatchObject({
      sharpe: null,
      sortino: null,
      volatility: 0,
    });
    expect(computeMetrics([100])).toMatchObject({ totalReturn: 0, cagr: 0, winRate: null });
  });
});

describe("maxDrawdown", () => {
  it("is the worst fall from a running peak", () => {
    expect(maxDrawdown([100, 120, 90, 130, 117])).toBeCloseTo(0.25, 12);
    expect(maxDrawdown([1, 2, 3])).toBe(0);
  });
});
