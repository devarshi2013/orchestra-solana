import { describe, expect, it } from "vitest";

import { isScheduledRebalance, maxDrift } from "./schedule";

describe("isScheduledRebalance", () => {
  it("always trades on the first day", () => {
    for (const kind of ["daily", "weekly", "monthly"] as const) {
      expect(isScheduledRebalance({ kind }, "2026-03-04", null)).toBe(true);
    }
    expect(isScheduledRebalance({ kind: "threshold", driftPct: 5 }, "2026-03-04", null)).toBe(true);
  });

  it.each([
    // 2026-03-01 is a Sunday, 2026-03-02 a Monday.
    ["daily", "2026-03-04", "2026-03-03", true],
    ["weekly", "2026-03-02", "2026-03-01", true],
    ["weekly", "2026-03-08", "2026-03-07", false],
    ["weekly", "2026-03-09", "2026-03-05", true], // gap spanning a Monday
    ["monthly", "2026-04-01", "2026-03-31", true],
    ["monthly", "2026-03-31", "2026-03-30", false],
    ["threshold", "2026-04-01", "2026-03-31", false],
  ] as const)("%s on %s after %s → %s", (kind, date, previous, expected) => {
    const rule = kind === "threshold" ? { kind, driftPct: 5 } : { kind };
    expect(isScheduledRebalance(rule, date, previous)).toBe(expected);
  });
});

describe("maxDrift", () => {
  it("is the largest weight gap, counting mints missing on either side", () => {
    expect(maxDrift({ A: 0.6, B: 0.4 }, { A: 0.5, B: 0.5 })).toBeCloseTo(0.1, 12);
    expect(maxDrift({ A: 1 }, { B: 1 })).toBe(1);
  });
});
