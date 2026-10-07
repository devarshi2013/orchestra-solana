import { describe, expect, it } from "vitest";

import { canQuoteLeg, deriveRunStatus, nextLegIndex, type LegStatus } from "./run-state";

const legs = (...statuses: LegStatus[]) => statuses.map((status, index) => ({ index, status }));

describe("deriveRunStatus", () => {
  it.each([
    [["succeeded", "skipped"], "completed"],
    [["succeeded", "failed", "pending"], "partial"],
    [["pending", "pending"], "planned"],
    [["succeeded", "quoted"], "executing"],
    [["executing", "pending"], "executing"],
  ] as const)("%o → %s", (statuses, expected) => {
    expect(deriveRunStatus(legs(...statuses))).toBe(expected);
  });
});

describe("leg order", () => {
  it("runs the first unfinished leg next", () => {
    expect(nextLegIndex(legs("succeeded", "skipped", "failed", "pending"))).toBe(2);
    expect(nextLegIndex(legs("succeeded"))).toBeNull();
  });

  it("only lets a leg be quoted once every earlier leg is done", () => {
    const run = legs("succeeded", "failed", "pending");
    expect(canQuoteLeg(run, 1)).toBeNull(); // retry the failed leg
    expect(canQuoteLeg(run, 2)).toBe("Earlier legs must finish first");
    expect(canQuoteLeg(run, 0)).toBe("This leg is already done");
    expect(canQuoteLeg(legs("executing"), 0)).toBe("This leg is still executing");
    expect(canQuoteLeg(run, 9)).toBe("No such leg");
    expect(canQuoteLeg(legs("succeeded", "quoted"), 1)).toBeNull(); // re-quote an expired quote
  });
});
