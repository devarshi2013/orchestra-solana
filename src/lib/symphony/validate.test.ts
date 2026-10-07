import { describe, expect, it } from "vitest";

import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

import { EXAMPLE_SYMPHONIES, JUP_MINT } from "./examples";
import type { Symphony, SymphonyNode } from "./types";
import { validateSymphony } from "./validate";

const known = new Set([SOL_MINT, USDC_MINT, JUP_MINT]);
const options = { isKnownMint: (mint: string) => known.has(mint) };
const UNKNOWN = "UnknownMint1111111111111111111111111111111";
const wrap = (root: SymphonyNode): Symphony => ({ version: 1, name: "t", root });

describe("validateSymphony", () => {
  it("accepts a valid tree", () => {
    const tree = wrap({
      type: "group",
      name: "thirds",
      weight: { method: "specified", percentages: [33.33, 33.33, 33.34] },
      children: [SOL_MINT, USDC_MINT, JUP_MINT].map((mint) => ({ type: "asset", mint })),
    });
    expect(validateSymphony(tree, options)).toEqual([]);
  });

  it("reports specified weights that don't sum to 100 or don't match the children", () => {
    const tree = wrap({
      type: "group",
      name: "bad",
      weight: { method: "specified", percentages: [60, 30, 5] },
      children: [
        { type: "asset", mint: SOL_MINT },
        { type: "asset", mint: JUP_MINT },
      ],
    });
    expect(validateSymphony(tree, options)).toEqual([
      { path: "root.weight.percentages", message: "Expected 2 percentages (one per child), got 3" },
      { path: "root.weight.percentages", message: "Weights must sum to 100%, got 95%" },
    ]);
  });

  it("reports empty groups and filters at any depth", () => {
    const tree = wrap({
      type: "group",
      name: "outer",
      weight: { method: "equal" },
      children: [
        { type: "group", name: "inner", weight: { method: "equal" }, children: [] },
        {
          type: "filter",
          sortBy: { fn: "price" },
          select: { direction: "top", count: 1 },
          children: [],
        },
      ],
    });
    expect(validateSymphony(tree, options)).toEqual([
      { path: "root.children[0].children", message: "Group is empty" },
      { path: "root.children[1].children", message: "Filter is empty" },
    ]);
  });

  it("reports unknown mints in assets and both sides of conditions", () => {
    const tree = wrap({
      type: "if",
      condition: {
        left: { mint: UNKNOWN, indicator: { fn: "price" } },
        comparator: "gt",
        right: { mint: UNKNOWN, indicator: { fn: "sma", period: 5 } },
      },
      then: {
        type: "if",
        condition: {
          left: { mint: SOL_MINT, indicator: { fn: "price" } },
          comparator: "lt",
          right: 1,
        },
        then: { type: "asset", mint: SOL_MINT },
        else: { type: "asset", mint: USDC_MINT },
      },
      else: { type: "asset", mint: UNKNOWN },
    });
    expect(validateSymphony(tree, options).map((i) => i.path)).toEqual([
      "root.condition.left.mint",
      "root.condition.right.mint",
      "root.else.mint",
    ]);
  });

  it("accepts every example symphony", () => {
    for (const symphony of EXAMPLE_SYMPHONIES) {
      expect(validateSymphony(symphony, { isKnownMint: () => true })).toEqual([]);
    }
  });
});
