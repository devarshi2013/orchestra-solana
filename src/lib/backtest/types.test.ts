import { describe, expect, it } from "vitest";

import { backtestConfigSchema } from "./types";

const valid = {
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  rebalance: { kind: "threshold", driftPct: 5 },
  startingCapitalUsdc: 1000,
  feeBps: 10,
  slippageBps: 20,
};

describe("backtestConfigSchema", () => {
  it("accepts a valid config", () => {
    expect(backtestConfigSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["an end before the start", { endDate: "2025-12-31" }],
    ["a non-ISO date", { startDate: "01/01/2026" }],
    ["zero capital", { startingCapitalUsdc: 0 }],
    ["negative fees", { feeBps: -1 }],
    ["a zero drift threshold", { rebalance: { kind: "threshold", driftPct: 0 } }],
  ])("rejects %s", (_, overrides) => {
    expect(backtestConfigSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
  });
});
