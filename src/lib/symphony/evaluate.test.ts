import { describe, expect, it } from "vitest";

import {
  barsNeeded,
  evaluate,
  evaluateWithWarnings,
  SymphonyEvaluationError,
  type EvaluationWarning,
} from "./evaluate";
import type { MarketData } from "./market-data";
import type { Condition, IndicatorSpec, SymphonyNode } from "./types";

// Mint strings are opaque to evaluate(); short names keep expectations readable.
const asset = (mint: string): SymphonyNode => ({ type: "asset", mint });
const equal = (...children: SymphonyNode[]): SymphonyNode => ({
  type: "group",
  name: "g",
  weight: { method: "equal" },
  children,
});
const ind = (mint: string, indicator: IndicatorSpec = { fn: "price" }) => ({ mint, indicator });
const when = (condition: Condition, then: SymphonyNode, otherwise: SymphonyNode): SymphonyNode => ({
  type: "if",
  condition,
  then,
  else: otherwise,
});
/** An `if` that warns if evaluated (mint "missing" has no data). */
const poisoned = when({ left: ind("missing"), comparator: "gt", right: 0 }, asset("A"), asset("A"));

function day(i: number): string {
  return new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
}

/** Daily data starting 2026-01-01; every series must have the same length. */
function market(closes: Record<string, (number | null)[]>): MarketData {
  const length = Object.values(closes)[0]?.length ?? 0;
  return { dates: Array.from({ length }, (_, i) => day(i)), closes };
}

const EMPTY = market({});
const LAST = (data: MarketData) => data.dates[data.dates.length - 1]!;

describe("evaluate: leaves and groups", () => {
  it("allocates everything to a lone asset without needing market data", () => {
    expect(evaluate(asset("A"), EMPTY, "2026-01-01")).toEqual({ A: 1 });
  });

  it("splits an equal-weight group evenly and merges repeated mints", () => {
    expect(evaluate(equal(asset("A"), asset("B")), EMPTY, "2026-01-01")).toEqual({
      A: 0.5,
      B: 0.5,
    });
    expect(evaluate(equal(asset("A"), equal(asset("A"), asset("B"))), EMPTY, "x")).toEqual({
      A: 0.75,
      B: 0.25,
    });
  });

  const specified = (percentages: number[], children: SymphonyNode[]): SymphonyNode => ({
    type: "group",
    name: "fixed",
    weight: { method: "specified", percentages },
    children,
  });

  it("applies specified percentages, dropping 0% children", () => {
    const tree = specified([60, 40, 0], [asset("A"), asset("B"), asset("C")]);
    expect(evaluate(tree, EMPTY, "x")).toEqual({ A: 0.6, B: 0.4 });
  });

  it("normalizes percentages that don't sum to 100", () => {
    expect(evaluate(specified([3, 2], [asset("A"), asset("B")]), EMPTY, "x")).toEqual({
      A: 0.6,
      B: 0.4,
    });
  });

  it.each([
    ["a missing percentage", [100]],
    ["all-zero percentages", [0, 0]],
  ])("rejects %s", (_, percentages) => {
    expect(() => evaluate(specified(percentages, [asset("A"), asset("B")]), EMPTY, "x")).toThrow(
      SymphonyEvaluationError,
    );
  });

  it("rejects empty groups and filters", () => {
    expect(() => evaluate(equal(), EMPTY, "x")).toThrow('Group "g" has no children');
    const filter: SymphonyNode = {
      type: "filter",
      sortBy: { fn: "price" },
      select: { direction: "top", count: 1 },
      children: [],
    };
    expect(() => evaluate(filter, EMPTY, "x")).toThrow("Filter has no children");
  });
});

describe("evaluate: inverse volatility", () => {
  const inverseVol = (...children: SymphonyNode[]): SymphonyNode => ({
    type: "group",
    name: "risk parity",
    weight: { method: "inverseVolatility", lookbackDays: 2 },
    children,
  });

  it("weights children by 1 / stdev of daily returns", () => {
    // A moves ±1% a day, B ±2%: A gets twice B's weight.
    const data = market({ A: [100, 101, 99.99], B: [100, 102, 99.96] });
    const result = evaluate(inverseVol(asset("A"), asset("B")), data, LAST(data));
    expect(result.A).toBeCloseTo(2 / 3, 12);
    expect(result.B).toBeCloseTo(1 / 3, 12);
  });

  it("gives everything to zero-volatility children", () => {
    const data = market({ A: [100, 101, 99.99], C: [1, 1, 1], D: [5, 5, 5] });
    const tree = inverseVol(asset("A"), asset("C"), asset("D"));
    expect(evaluate(tree, data, LAST(data))).toEqual({ C: 0.5, D: 0.5 });
  });

  it("measures a composite child on its constant-weight index", () => {
    // A and B move in opposite directions, so the 50/50 child has zero volatility.
    const data = market({ A: [100, 110, 99], B: [100, 90, 99], C: [100, 101, 99.99] });
    const tree = inverseVol(equal(asset("A"), asset("B")), asset("C"));
    expect(evaluate(tree, data, LAST(data))).toEqual({ A: 0.5, B: 0.5 });
  });

  it("falls back to equal weights, warning per short child, when any child lacks history", () => {
    // "new" listed yesterday: 1 close, but stdev over 2 days needs 3.
    const data = market({ A: [100, 101, 99.99], new: [null, null, 5] });
    const { allocation, warnings } = evaluateWithWarnings(
      inverseVol(asset("A"), asset("new")),
      data,
      LAST(data),
    );
    expect(allocation).toEqual({ A: 0.5, new: 0.5 });
    expect(warnings).toEqual([
      {
        kind: "insufficient_history",
        path: "root.children[1]",
        mint: "new",
        indicator: { fn: "stdevReturn", period: 2 },
        barsNeeded: 3,
        barsAvailable: 1,
        fallback: "equal_weight",
      },
    ]);
  });
});

describe("evaluate: if", () => {
  const data = market({ A: [1, 2, 3, 4, 5], B: [5, 5, 5, 5, 5] });
  const date = LAST(data);

  it.each([
    ["gt", 5, false],
    ["gt", 4, true],
    ["gte", 5, true],
    ["gte", 6, false],
    ["lt", 5, false],
    ["lt", 6, true],
    ["lte", 5, true],
    ["lte", 4, false],
  ] as const)("price(A)=5 %s %d → %s", (comparator, value, expected) => {
    const tree = when({ left: ind("A"), comparator, right: value }, asset("T"), asset("F"));
    expect(evaluate(tree, data, date)).toEqual(expected ? { T: 1 } : { F: 1 });
  });

  it("compares two indicators", () => {
    // price(A)=5 > SMA3(A)=4; price(B)=5 is not > SMA3(B)=5.
    const above = (mint: string) =>
      when(
        { left: ind(mint), comparator: "gt", right: ind(mint, { fn: "sma", period: 3 }) },
        asset("up"),
        asset("down"),
      );
    expect(evaluate(above("A"), data, date)).toEqual({ up: 1 });
    expect(evaluate(above("B"), data, date)).toEqual({ down: 1 });
  });

  it("evaluates only the taken branch", () => {
    const tree = when({ left: ind("A"), comparator: "gt", right: 0 }, asset("T"), poisoned);
    expect(evaluateWithWarnings(tree, data, date)).toEqual({ allocation: { T: 1 }, warnings: [] });
    expect(evaluateWithWarnings(poisoned, data, date).warnings).toHaveLength(1);
  });

  it("uses only bars on or before the date (no look-ahead)", () => {
    const tree = when({ left: ind("A"), comparator: "gte", right: 3 }, asset("T"), asset("F"));
    expect(evaluate(tree, data, day(1))).toEqual({ F: 1 }); // price 2
    expect(evaluate(tree, data, `${day(2)}T23:59`)).toEqual({ T: 1 }); // between bars → day 2
    expect(evaluate(tree, data, "2099-01-01")).toEqual({ T: 1 }); // after the last bar
  });

  const sma = (period: number) =>
    when(
      { left: ind("A", { fn: "sma", period }), comparator: "gt", right: 0 },
      asset("T"),
      asset("F"),
    );
  const shortHistory = (
    barsNeeded: number,
    barsAvailable: number,
    path = "root",
  ): EvaluationWarning => ({
    kind: "insufficient_history",
    path,
    mint: "A",
    indicator: { fn: "sma", period: barsNeeded },
    barsNeeded,
    barsAvailable,
    fallback: "else",
  });

  it("falls back to else, with a warning, when history is too short", () => {
    expect(evaluateWithWarnings(sma(5), data, date)).toEqual({
      allocation: { T: 1 },
      warnings: [],
    });
    expect(evaluateWithWarnings(sma(6), data, date)).toEqual({
      allocation: { F: 1 },
      warnings: [shortHistory(6, 5)],
    });
  });

  it("treats a date before the data, or a gap, as short history", () => {
    expect(evaluateWithWarnings(sma(1), data, "2025-12-31").warnings).toEqual([shortHistory(1, 0)]);
    const gappy = market({ A: [1, null, 3] });
    expect(evaluateWithWarnings(sma(2), gappy, LAST(gappy)).warnings).toEqual([shortHistory(2, 1)]);
  });

  it("warns for each side of a condition that lacks history", () => {
    const tree = when(
      { left: ind("A", { fn: "sma", period: 9 }), comparator: "lt", right: ind("missing") },
      asset("T"),
      asset("F"),
    );
    const { allocation, warnings } = evaluateWithWarnings(tree, data, date);
    expect(allocation).toEqual({ F: 1 });
    expect(warnings.map((w) => [w.mint, w.barsAvailable])).toEqual([
      ["A", 5],
      ["missing", 0],
    ]);
  });
});

describe("evaluate: filter", () => {
  const data = market({
    A: [100, 110], // +10%
    B: [100, 130], // +30%
    C: [100, 90], // -10%
    D: [100, 120], // +20%
  });
  const date = LAST(data);
  const filter = (
    direction: "top" | "bottom",
    count: number,
    children: SymphonyNode[],
    sortBy: IndicatorSpec = { fn: "cumulativeReturn", period: 1 },
  ): SymphonyNode => ({ type: "filter", sortBy, select: { direction, count }, children });
  const abcd = ["A", "B", "C", "D"].map(asset);

  it("keeps the top N, equally weighted", () => {
    expect(evaluate(filter("top", 2, abcd), data, date)).toEqual({ B: 0.5, D: 0.5 });
  });

  it("keeps the bottom N", () => {
    expect(evaluate(filter("bottom", 1, abcd), data, date)).toEqual({ C: 1 });
  });

  it("keeps every child when N exceeds the child count", () => {
    expect(evaluate(filter("top", 9, [asset("A"), asset("C")]), data, date)).toEqual({
      A: 0.5,
      C: 0.5,
    });
  });

  it("breaks ties by tree order", () => {
    const tied = market({ X: [1, 2], Y: [1, 2], Z: [1, 2] });
    const children = ["Z", "X", "Y"].map(asset);
    expect(evaluate(filter("top", 1, children), tied, LAST(tied))).toEqual({ Z: 1 });
    expect(evaluate(filter("bottom", 1, children), tied, LAST(tied))).toEqual({ Z: 1 });
  });

  it("ranks a composite child on its constant-weight index", () => {
    // equal(B, C) returns (30% − 10%) / 2 = +10%: behind D (+20%), ahead of C (−10%).
    const children = [asset("C"), equal(asset("B"), asset("C")), asset("D")];
    expect(evaluate(filter("top", 2, children), data, date)).toEqual({ B: 0.25, C: 0.25, D: 0.5 });
  });

  it("ranks a child resolving to one mint on that mint's own prices", () => {
    // By raw price: the `if` resolves to B (130) and beats D (120).
    const toB = when({ left: ind("B"), comparator: "gt", right: 0 }, asset("B"), asset("C"));
    expect(evaluate(filter("top", 1, [asset("D"), toB], { fn: "price" }), data, date)).toEqual({
      B: 1,
    });
  });

  it("ranks children without enough history last, in either direction", () => {
    const withNew = market({ ...data.closes, new: [null, 100] });
    const children = [asset("new"), asset("A"), asset("C")];
    for (const direction of ["top", "bottom"] as const) {
      const { allocation, warnings } = evaluateWithWarnings(
        filter(direction, 2, children),
        withNew,
        date,
      );
      expect(allocation).toEqual({ A: 0.5, C: 0.5 });
      expect(warnings).toMatchObject([
        { path: "root.children[0]", mint: "new", fallback: "ranked_last" },
      ]);
    }
    // Picked anyway when there aren't enough measurable children.
    expect(evaluate(filter("top", 3, children), withNew, date)).toEqual({
      A: 1 / 3,
      C: 1 / 3,
      new: 1 / 3,
    });
  });

  it("measures a composite child over the span all its constituents share", () => {
    const withNew = market({ ...data.closes, new: [null, 100] });
    const { warnings } = evaluateWithWarnings(
      filter("top", 1, [equal(asset("B"), asset("new")), asset("A")]),
      withNew,
      date,
    );
    expect(warnings).toMatchObject([{ mint: "new", barsAvailable: 1, barsNeeded: 2 }]);
    const neverListed = evaluateWithWarnings(
      filter("top", 1, [equal(asset("B"), asset("ghost")), asset("A")]),
      withNew,
      date,
    );
    expect(neverListed.allocation).toEqual({ A: 1 });
    expect(neverListed.warnings).toMatchObject([{ mint: "ghost", barsAvailable: 0 }]);
  });
});

describe("evaluate: purity", () => {
  it("is deterministic and does not mutate its inputs", () => {
    const deepFreeze = <T>(value: T): T => {
      if (value && typeof value === "object") {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
      }
      return value;
    };
    const data = deepFreeze(market({ A: [100, 101, 99.99], B: [100, 102, 99.96] }));
    const tree = deepFreeze<SymphonyNode>({
      type: "group",
      name: "mix",
      weight: { method: "inverseVolatility", lookbackDays: 2 },
      children: [asset("A"), equal(asset("A"), asset("B"))],
    });
    const first = evaluate(tree, data, LAST(data));
    expect(evaluate(tree, data, LAST(data))).toEqual(first);
  });
});

describe("barsNeeded", () => {
  it("is 0 for trees that read no data", () => {
    expect(barsNeeded(asset("A"))).toBe(0);
    expect(barsNeeded(equal(asset("A"), asset("B")))).toBe(0);
  });

  it("takes the deepest requirement anywhere in the tree", () => {
    const tree: SymphonyNode = {
      type: "filter",
      sortBy: { fn: "rsi", period: 14 }, // 15 bars
      select: { direction: "top", count: 1 },
      children: [
        when(
          { left: ind("A", { fn: "sma", period: 50 }), comparator: "gt", right: 0 },
          {
            type: "group",
            name: "rp",
            weight: { method: "inverseVolatility", lookbackDays: 60 }, // 61 bars
            children: [asset("A")],
          },
          asset("B"),
        ),
      ],
    };
    expect(barsNeeded(tree)).toBe(61);
  });

  it("counts an indicator on the right of a condition", () => {
    const tree = when(
      { left: ind("A"), comparator: "gt", right: ind("A", { fn: "ema", period: 20 }) },
      asset("A"),
      asset("B"),
    );
    expect(barsNeeded(tree)).toBe(20);
  });
});
