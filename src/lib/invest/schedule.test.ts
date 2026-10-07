import { describe, expect, it } from "vitest";

import { describeRule, nextDueAt } from "./schedule";

const iso = (d: Date) => d.toISOString();
// 2026-10-07 is a Wednesday.
const WED_NOON = new Date("2026-10-07T12:00:00Z");
const WED_EARLY = new Date("2026-10-07T00:05:00Z");

describe("nextDueAt", () => {
  it.each([
    [{ kind: "daily" }, WED_NOON, "2026-10-08T00:20:00.000Z"],
    [{ kind: "daily" }, WED_EARLY, "2026-10-07T00:20:00.000Z"],
    [{ kind: "threshold", driftPct: 5 }, WED_NOON, "2026-10-08T00:20:00.000Z"],
    [{ kind: "weekly" }, WED_NOON, "2026-10-12T00:20:00.000Z"],
    [{ kind: "weekly" }, new Date("2026-10-12T00:20:00Z"), "2026-10-19T00:20:00.000Z"],
    [{ kind: "weekly" }, new Date("2026-10-12T00:00:00Z"), "2026-10-12T00:20:00.000Z"],
    [{ kind: "monthly" }, WED_NOON, "2026-11-01T00:20:00.000Z"],
    [{ kind: "monthly" }, new Date("2026-12-31T23:00:00Z"), "2027-01-01T00:20:00.000Z"],
    [{ kind: "monthly" }, new Date("2026-11-01T00:00:00Z"), "2026-11-01T00:20:00.000Z"],
  ] as const)("%o after %s → %s", (rule, after, expected) => {
    expect(iso(nextDueAt(rule, after))).toBe(expected);
  });

  it("describes rules", () => {
    expect(describeRule({ kind: "threshold", driftPct: 5 })).toBe(
      "When any holding drifts 5 pts from target",
    );
    expect(describeRule({ kind: "weekly" })).toBe("Weekly (Mondays)");
  });
});
