import { describe, expect, it } from "vitest";

import { diffOutlines, outline } from "./outline";
import type { TickerSymphony } from "./ticker-tree";

const before: TickerSymphony = {
  name: "Split",
  root: {
    type: "group",
    name: "Core",
    weight: { method: "specified", percentages: [60, 40] },
    children: [
      { type: "asset", ticker: "SOL" },
      { type: "asset", ticker: "JUP" },
    ],
  },
};

describe("outline", () => {
  it("describes the tree line by line", () => {
    expect(outline(before)).toEqual([
      { depth: 0, text: "Split" },
      { depth: 1, text: 'Group "Core" · weights 60% / 40%' },
      { depth: 2, text: "60% SOL" },
      { depth: 2, text: "40% JUP" },
    ]);
  });
});

describe("diffOutlines", () => {
  it("marks added and removed lines and keeps the rest", () => {
    const after: TickerSymphony = structuredClone(before);
    if (after.root.type !== "group") throw new Error();
    after.root.weight = { method: "specified", percentages: [50, 50] };
    const diff = diffOutlines(outline(before), outline(after));
    expect(diff.map((l) => [l.change, l.text])).toEqual([
      ["same", "Split"],
      ["removed", 'Group "Core" · weights 60% / 40%'],
      ["removed", "60% SOL"],
      ["removed", "40% JUP"],
      ["added", 'Group "Core" · weights 50% / 50%'],
      ["added", "50% SOL"],
      ["added", "50% JUP"],
    ]);
    expect(diffOutlines(outline(before), outline(before)).every((l) => l.change === "same")).toBe(
      true,
    );
  });
});
