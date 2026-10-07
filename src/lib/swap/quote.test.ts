import { describe, expect, it } from "vitest";

import { describePriceImpact, isOrderExpired, summarizeRoute } from "./quote";

describe("summarizeRoute", () => {
  it("labels hops and falls back to bps", () => {
    const hops = summarizeRoute({
      routePlan: [
        { swapInfo: { label: "Meteora DLMM", inputMint: "a", outputMint: "b" }, percent: 100 },
        { swapInfo: { label: null, inputMint: "b", outputMint: "c" }, bps: 5000 },
      ],
    });
    expect(hops).toEqual([
      { label: "Meteora DLMM", percent: 100 },
      { label: "Unknown venue", percent: 50 },
    ]);
  });

  it("handles a missing route plan", () => {
    expect(summarizeRoute({ routePlan: null })).toEqual([]);
  });
});

describe("describePriceImpact", () => {
  it("uses percentage points and grades severity", () => {
    expect(describePriceImpact(-0.004)).toEqual({ text: "<0.01%", severity: "low" });
    expect(describePriceImpact(-1.234)).toEqual({ text: "1.23%", severity: "medium" });
    expect(describePriceImpact(-7)).toEqual({ text: "7.00%", severity: "high" });
    expect(describePriceImpact(undefined).severity).toBe("low");
  });
});

describe("isOrderExpired", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");

  it("checks RFQ expireAt in ISO, seconds and milliseconds", () => {
    expect(isOrderExpired({ expireAt: "2026-10-07T11:59:59Z" }, { now })).toBe(true);
    expect(isOrderExpired({ expireAt: "2026-10-07T12:00:30Z" }, { now })).toBe(false);
    expect(isOrderExpired({ expireAt: String(now / 1000 - 1) }, { now })).toBe(true);
    expect(isOrderExpired({ expireAt: String(now + 5000) }, { now })).toBe(false);
  });

  it("checks lastValidBlockHeight against the current block height", () => {
    expect(isOrderExpired({ lastValidBlockHeight: "100" }, { now, blockHeight: 101 })).toBe(true);
    expect(isOrderExpired({ lastValidBlockHeight: "100" }, { now, blockHeight: 100 })).toBe(false);
    expect(isOrderExpired({ lastValidBlockHeight: "100" }, { now })).toBe(false);
  });
});
