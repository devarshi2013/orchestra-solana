import { describe, expect, it } from "vitest";

import { EXAMPLE_SYMPHONIES, solTrendFollower } from "./examples";
import { parseSymphony, serializeSymphony } from "./serialize";

describe("symphony JSON", () => {
  it.each(EXAMPLE_SYMPHONIES.map((s) => [s.name, s] as const))("round-trips %s", (_, symphony) => {
    const parsed = parseSymphony(serializeSymphony(symphony));
    expect(parsed).toEqual({ ok: true, symphony });
  });

  it("serializes identically regardless of key order and drops unknown keys", () => {
    const { root, ...rest } = solTrendFollower;
    const shuffled = { root, extra: 1, ...rest };
    expect(serializeSymphony(shuffled)).toBe(serializeSymphony(solTrendFollower));
    expect(serializeSymphony(shuffled)).not.toContain("extra");
  });

  it("rejects malformed JSON", () => {
    expect(parseSymphony("{")).toEqual({ ok: false, error: "Not valid JSON" });
  });

  it.each([
    ["an unknown version", { ...solTrendFollower, version: 2 }],
    ["an unknown node type", { ...solTrendFollower, root: { type: "loop" } }],
    ["a malformed mint", { ...solTrendFollower, root: { type: "asset", mint: "0xabc" } }],
    [
      "a fractional period",
      {
        ...solTrendFollower,
        root: {
          type: "filter",
          sortBy: { fn: "sma", period: 2.5 },
          select: { direction: "top", count: 1 },
          children: [],
        },
      },
    ],
  ])("rejects %s", (_, value) => {
    const result = parseSymphony(JSON.stringify(value));
    expect(result.ok).toBe(false);
  });
});
