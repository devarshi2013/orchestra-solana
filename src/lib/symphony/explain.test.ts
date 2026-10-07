import { describe, expect, it } from "vitest";

import { USDC_MINT, SOL_MINT } from "@/lib/assets/allowlist";

import { evaluate, evaluateWithTrace } from "./evaluate";
import {
  BONK_MINT,
  EXAMPLE_TOKEN_SYMBOLS,
  JTO_MINT,
  JUP_MINT,
  PYTH_MINT,
  RAY_MINT,
  solanaMomentumTop3,
  solJup6040,
  solTrendFollower,
} from "./examples";
import { explainSymphonyChange, summarizeExplanation, summarizeRebalance } from "./explain";
import type { MarketData } from "./market-data";
import type { Allocation, SymphonyNode } from "./types";

const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
function market(closes: Record<string, (number | null)[]>): MarketData {
  const length = Object.values(closes)[0]!.length;
  return { dates: Array.from({ length }, (_, i) => day(i)), closes };
}
const labelOf = (mint: string) => EXAMPLE_TOKEN_SYMBOLS[mint] ?? mint;
const byTicker = (allocation: Allocation) =>
  Object.fromEntries(Object.entries(allocation).map(([m, w]) => [labelOf(m), w]));

// SOL rises for 60 days, then falls hard: above its 50-day SMA on day 59, below it by day 79.
const solUpThenDown = [
  ...Array.from({ length: 60 }, (_, i) => 100 + i),
  ...Array.from({ length: 20 }, (_, i) => 159 - 6 * (i + 1)),
];
const trendData = market({ [SOL_MINT]: solUpThenDown, [USDC_MINT]: solUpThenDown.map(() => 1) });

// Momentum: the leaders change between day 40 and day 79.
const ramp = (start: number, perDay: number, flipAt: number, after: number) =>
  Array.from({ length: 80 }, (_, i) =>
    i < flipAt ? start + perDay * i : start + perDay * flipAt + after * (i - flipAt),
  );
const momentumData = market({
  [SOL_MINT]: ramp(100, 2, 50, -2),
  [JUP_MINT]: ramp(1, 0.02, 50, -0.02),
  [BONK_MINT]: ramp(1, 0.015, 50, 0.03),
  [JTO_MINT]: ramp(2, 0.0, 50, 0.05),
  [PYTH_MINT]: ramp(0.5, 0.001, 50, 0.01),
  [RAY_MINT]: ramp(3, 0.01, 50, -0.01),
});

describe("explainSymphonyChange matches evaluate()", () => {
  const cases: [string, SymphonyNode, MarketData][] = [
    ["trend follower", solTrendFollower.root, trendData],
    ["momentum top 3", solanaMomentumTop3.root, momentumData],
    ["static 60/40", solJup6040.root, momentumData],
  ];
  it.each(cases)("%s: both targets are evaluate()'s allocations", (_, tree, data) => {
    const ex = explainSymphonyChange({ tree, data, from: day(59), to: day(79), labelOf });
    expect(ex.targetBefore).toEqual(byTicker(evaluate(tree, data, day(59))));
    expect(ex.targetNow).toEqual(byTicker(evaluate(tree, data, day(79))));
    expect(ex.from).toBe(day(59));
    expect(ex.to).toBe(day(79));
  });

  it("reports the flipped condition with evaluate()'s own values, and the target move", () => {
    const ex = explainSymphonyChange({
      tree: solTrendFollower.root,
      data: trendData,
      from: day(59),
      to: day(79),
      labelOf,
    });
    const traced = evaluateWithTrace(solTrendFollower.root, trendData, day(79)).trace[0]!;
    expect(ex.conditions).toHaveLength(1);
    const [c] = ex.conditions;
    expect(c).toMatchObject({
      path: "root",
      description: "SOL price > SOL 50d SMA",
      changed: true,
      before: { result: true, branch: "then" },
      now: { result: false, branch: "else" },
    });
    expect(traced.kind === "condition" && traced.left.value).toBe(c!.now!.left.value);
    expect(ex.targetChanges).toEqual([
      { ticker: "SOL", before: 1, now: 0, changePts: -100 },
      { ticker: "USDC", before: 0, now: 1, changePts: 100 },
    ]);
    expect(summarizeExplanation(ex)).toEqual([
      `"SOL price > SOL 50d SMA" went from true to false (now SOL price = 39 vs SOL 50d SMA = ${Number(
        (c!.now!.right as { value: number }).value.toPrecision(6),
      )}).`,
      "Target moved: SOL 100.0% → 0.0%, USDC 0.0% → 100.0%.",
    ]);
  });

  it("reports changed filter picks", () => {
    const ex = explainSymphonyChange({
      tree: solanaMomentumTop3.root,
      data: momentumData,
      from: day(45),
      to: day(79),
      labelOf,
    });
    const [f] = ex.filters;
    expect(f!.description).toBe("Pick top 3 by 30d return");
    expect(f!.changed).toBe(true);
    expect(new Set(f!.now)).toEqual(
      new Set(Object.keys(byTicker(evaluate(solanaMomentumTop3.root, momentumData, day(79))))),
    );
  });

  it("says nothing changed for a static split, and reports wallet drift", () => {
    const ex = explainSymphonyChange({
      tree: solJup6040.root,
      data: momentumData,
      from: day(40),
      to: day(79),
      labelOf,
    });
    expect(ex.targetChanges).toEqual([]);
    expect(
      summarizeRebalance({
        ...ex,
        since: "last_rebalance",
        walletUsd: 100,
        drift: [
          { ticker: "SOL", weight: 0.7, target: 0.6, driftPts: 10 },
          { ticker: "JUP", weight: 0.3, target: 0.4, driftPts: -10 },
        ],
      }),
    ).toEqual([
      `No condition or ranking changed since ${day(40)}.`,
      "The target allocation is unchanged.",
      "Your wallet is off target: SOL is 70.0% vs 60.0% target, JUP is 30.0% vs 40.0% target.",
    ]);
  });

  it("says when the wallet holds nothing yet instead of quoting drift", () => {
    const ex = explainSymphonyChange({
      tree: solJup6040.root,
      data: momentumData,
      from: day(79),
      to: day(79),
      labelOf,
    });
    const lines = summarizeRebalance({ ...ex, since: "started", walletUsd: 0, drift: [] });
    expect(lines.at(-1)).toBe(
      "Your wallet doesn't hold any of this symphony's tokens or USDC yet.",
    );
  });

  it("handles a start date before any stored history", () => {
    const ex = explainSymphonyChange({
      tree: solTrendFollower.root,
      data: trendData,
      from: "2025-06-01",
      to: day(79),
      labelOf,
    });
    expect(ex.from).toBeNull();
    expect(ex.targetBefore).toBeNull();
    expect(ex.conditions[0]!.before).toBeNull();
    expect(summarizeExplanation(ex)[0]).toMatch(/no stored price history before/);
  });
});

describe("evaluateWithTrace", () => {
  it("records the decisions evaluate() made, without changing its result", () => {
    for (const date of [day(30), day(59), day(79)]) {
      const traced = evaluateWithTrace(solTrendFollower.root, trendData, date);
      expect(traced.allocation).toEqual(evaluate(solTrendFollower.root, trendData, date));
      const entry = traced.trace[0]!;
      expect(entry.kind).toBe("condition");
      if (entry.kind !== "condition") return;
      const chose = entry.branch === "then" ? SOL_MINT : USDC_MINT;
      expect(traced.allocation).toEqual({ [chose]: 1 });
    }
  });

  it("records a fallback when history is too short", () => {
    const traced = evaluateWithTrace(solTrendFollower.root, trendData, day(10));
    expect(traced.trace[0]).toMatchObject({ kind: "condition", result: null, branch: "else" });
  });
});
