import { barsRequired, computeIndicator } from "@/lib/indicators/compute";

import { barIndexAt, historyAt, type MarketData } from "./market-data";
import type {
  Allocation,
  Condition,
  FilterNode,
  GroupNode,
  IndicatorSpec,
  SymphonyNode,
} from "./types";

/**
 * Thrown for trees evaluate() cannot give a meaning to. validate() reports all
 * of these up front; evaluate() only guards against silently wrong output.
 */
export class SymphonyEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SymphonyEvaluationError";
  }
}

/**
 * An indicator had too little history (e.g. a newly listed token), so its node
 * fell back to a default instead of failing:
 * - `else`: an `if` took its else branch;
 * - `ranked_last`: a filter ranked the child below every measurable child;
 * - `equal_weight`: an inverse-volatility group weighted its children equally.
 */
export type EvaluationWarning = {
  kind: "insufficient_history";
  /** Node that fell back, e.g. `root.children[1]`. */
  path: string;
  /** Mint with the shortest history; for a composite child, its shortest constituent. */
  mint: string;
  indicator: IndicatorSpec;
  barsNeeded: number;
  barsAvailable: number;
  fallback: "else" | "ranked_last" | "equal_weight";
};

export type Evaluation = { allocation: Allocation; warnings: EvaluationWarning[] };

/** One indicator value an `if` compared; null when there was too little history. */
export type TracedValue = { mint: string; indicator: IndicatorSpec; value: number | null };

/**
 * What a node decided during one evaluation, recorded by evaluateWithTrace().
 * Only nodes actually reached are traced (an untaken `if` branch isn't).
 */
export type TraceEntry =
  | {
      kind: "condition";
      path: string;
      left: TracedValue;
      comparator: Condition["comparator"];
      right: number | TracedValue;
      /** null: a side lacked history, so the else branch was taken. */
      result: boolean | null;
      branch: "then" | "else";
    }
  | {
      kind: "filter";
      path: string;
      sortBy: IndicatorSpec;
      direction: "top" | "bottom";
      count: number;
      /** Children in tree order with their scores; `selected` ones got the weight. */
      children: { index: number; score: number | null; selected: boolean }[];
    }
  | {
      kind: "inverseVolatility";
      path: string;
      /** Each child's weight; equal when a child lacked history. */
      weights: number[];
      fellBack: boolean;
    };

export type TracedEvaluation = Evaluation & { trace: TraceEntry[] };

type Context = {
  data: MarketData;
  index: number;
  warnings: EvaluationWarning[];
  /** Set by evaluateWithTrace(); decisions are only recorded when present. */
  trace?: TraceEntry[];
};

/**
 * The allocation `tree` asks for on `date` (ISO), using only bars on or before
 * that date, plus a warning for every node that fell back because an indicator
 * lacked history. Pure and deterministic: same inputs, same output, no clock,
 * randomness or mutation of inputs.
 *
 * Weights are fractions summing to 1; a mint reached through several branches
 * gets the sum. Only the taken branch of an `if` is evaluated.
 *
 * Indicators run on each mint's whole unbroken history up to the date, so EMA
 * and RSI match charting tools when enough history is supplied. A composite
 * child of a filter or inverse-volatility group is measured on its current
 * allocation held at constant weights; a child resolving to one mint uses that
 * mint's own closes.
 */
export function evaluateWithWarnings(
  tree: SymphonyNode,
  marketData: MarketData,
  date: string,
): Evaluation {
  const ctx: Context = {
    data: marketData,
    index: barIndexAt(marketData.dates, date),
    warnings: [],
  };
  const allocation = evaluateNode(tree, "root", ctx);
  return { allocation, warnings: ctx.warnings };
}

/**
 * evaluateWithWarnings() plus a record of every decision it made: each `if`
 * condition's values and outcome, each filter's ranking, each
 * inverse-volatility split. Same code path, so the trace always matches the
 * allocation.
 */
export function evaluateWithTrace(
  tree: SymphonyNode,
  marketData: MarketData,
  date: string,
): TracedEvaluation {
  const ctx: Context = {
    data: marketData,
    index: barIndexAt(marketData.dates, date),
    warnings: [],
    trace: [],
  };
  const allocation = evaluateNode(tree, "root", ctx);
  return { allocation, warnings: ctx.warnings, trace: ctx.trace! };
}

/** `evaluateWithWarnings` without the warnings. */
export function evaluate(tree: SymphonyNode, marketData: MarketData, date: string): Allocation {
  return evaluateWithWarnings(tree, marketData, date).allocation;
}

/** Fewest bars of history for every indicator in `tree` to have a value (the backtest warm-up). */
export function barsNeeded(tree: SymphonyNode): number {
  switch (tree.type) {
    case "asset":
      return 0;
    case "group": {
      const own =
        tree.weight.method === "inverseVolatility" ? barsRequired(stdevSpec(tree.weight)) : 0;
      return Math.max(own, ...tree.children.map(barsNeeded));
    }
    case "if": {
      const { left, right } = tree.condition;
      const rightBars = typeof right === "number" ? 0 : barsRequired(right.indicator);
      return Math.max(
        barsRequired(left.indicator),
        rightBars,
        barsNeeded(tree.then),
        barsNeeded(tree.else),
      );
    }
    case "filter":
      return Math.max(barsRequired(tree.sortBy), ...tree.children.map(barsNeeded));
  }
}

function evaluateNode(node: SymphonyNode, path: string, ctx: Context): Allocation {
  switch (node.type) {
    case "asset":
      return { [node.mint]: 1 };
    case "if":
      return isTrue(node.condition, path, ctx)
        ? evaluateNode(node.then, `${path}.then`, ctx)
        : evaluateNode(node.else, `${path}.else`, ctx);
    case "group":
      return evaluateGroup(node, path, ctx);
    case "filter":
      return evaluateFilter(node, path, ctx);
  }
}

const stdevSpec = ({ lookbackDays }: { lookbackDays: number }): IndicatorSpec => ({
  fn: "stdevReturn",
  period: lookbackDays,
});

function evaluateGroup(node: GroupNode, path: string, ctx: Context): Allocation {
  const allocations = evaluateChildren(node, path, ctx);
  const { weight } = node;
  const equalWeights = allocations.map(() => 1 / allocations.length);
  switch (weight.method) {
    case "equal":
      return combine(allocations, equalWeights);
    case "specified": {
      const { percentages } = weight;
      const total = percentages.reduce((sum, p) => sum + p, 0);
      if (percentages.length !== allocations.length || total <= 0) {
        throw new SymphonyEvaluationError(
          `Group "${node.name}" needs one positive-summing percentage per child`,
        );
      }
      return combine(
        allocations,
        percentages.map((p) => p / total),
      );
    }
    case "inverseVolatility": {
      const spec = stdevSpec(weight);
      const measurements = allocations.map((a, i) =>
        measure(a, spec, `${path}.children[${i}]`, ctx),
      );
      const vols = measurements.map((m) => m.value);
      if (!vols.every((v) => v !== null)) {
        measurements.forEach((m) => m.warn("equal_weight"));
        ctx.trace?.push({ kind: "inverseVolatility", path, weights: equalWeights, fellBack: true });
        return combine(allocations, equalWeights);
      }
      const weights = inverseVolatilityWeights(vols);
      ctx.trace?.push({ kind: "inverseVolatility", path, weights, fellBack: false });
      return combine(allocations, weights);
    }
  }
}

/** Zero-volatility children (e.g. a stablecoin on flat data) would get infinite weight; they share it all. */
function inverseVolatilityWeights(vols: readonly number[]): number[] {
  const calm = vols.filter((v) => v === 0).length;
  if (calm > 0) return vols.map((v) => (v === 0 ? 1 / calm : 0));
  const inverse = vols.map((v) => 1 / v);
  const total = inverse.reduce((sum, x) => sum + x, 0);
  return inverse.map((x) => x / total);
}

function evaluateFilter(node: FilterNode, path: string, ctx: Context): Allocation {
  const allocations = evaluateChildren(node, path, ctx);
  const sign = node.select.direction === "top" ? -1 : 1;
  const children = allocations.map((allocation, index) => {
    const measurement = measure(allocation, node.sortBy, `${path}.children[${index}]`, ctx);
    measurement.warn("ranked_last");
    return { allocation, index, score: measurement.value };
  });
  const ranked = [
    ...children
      .filter((c) => c.score !== null)
      // Ties keep tree order, so the result never depends on sort internals.
      .sort((a, b) => sign * (a.score! - b.score!) || a.index - b.index),
    ...children.filter((c) => c.score === null),
  ].slice(0, node.select.count);
  ctx.trace?.push({
    kind: "filter",
    path,
    sortBy: node.sortBy,
    direction: node.select.direction,
    count: node.select.count,
    children: children.map((c) => ({
      index: c.index,
      score: c.score,
      selected: ranked.some((r) => r.index === c.index),
    })),
  });
  return combine(
    ranked.map((r) => r.allocation),
    ranked.map(() => 1 / ranked.length),
  );
}

function evaluateChildren(node: GroupNode | FilterNode, path: string, ctx: Context): Allocation[] {
  if (node.children.length === 0) {
    const label = node.type === "group" ? `Group "${node.name}"` : "Filter";
    throw new SymphonyEvaluationError(`${label} has no children`);
  }
  return node.children.map((child, i) => evaluateNode(child, `${path}.children[${i}]`, ctx));
}

/** False when either side lacks history, so the `if` falls back to its else branch. */
function isTrue({ left, comparator, right }: Condition, path: string, ctx: Context): boolean {
  const a = measure({ [left.mint]: 1 }, left.indicator, path, ctx);
  const b =
    typeof right === "number"
      ? { value: right, warn: () => {} }
      : measure({ [right.mint]: 1 }, right.indicator, path, ctx);
  let result: boolean | null;
  if (a.value === null || b.value === null) {
    a.warn("else");
    b.warn("else");
    result = null;
  } else {
    result = compare(a.value, comparator, b.value);
  }
  ctx.trace?.push({
    kind: "condition",
    path,
    left: { mint: left.mint, indicator: left.indicator, value: a.value },
    comparator,
    right:
      typeof right === "number"
        ? right
        : { mint: right.mint, indicator: right.indicator, value: b.value },
    result,
    branch: result ? "then" : "else",
  });
  return result === true;
}

function compare(a: number, comparator: Condition["comparator"], b: number): boolean {
  switch (comparator) {
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
  }
}

type Measurement = {
  value: number | null;
  /** Records a warning if the value is missing; no-op otherwise. */
  warn: (fallback: EvaluationWarning["fallback"]) => void;
};

/**
 * `spec` on an allocation's price series: the mint's own closes for a
 * single-mint allocation, otherwise a constant-weight index starting at 1 over
 * the span every constituent has data for.
 */
function measure(
  allocation: Allocation,
  spec: IndicatorSpec,
  path: string,
  ctx: Context,
): Measurement {
  const holdings = Object.entries(allocation).map(([mint, weight]) => ({
    mint,
    weight,
    closes: historyAt(ctx.data, mint, ctx.index),
  }));
  const shortest = holdings.reduce((a, b) => (b.closes.length < a.closes.length ? b : a));
  const series =
    holdings.length === 1 ? shortest.closes : indexSeries(holdings, shortest.closes.length);
  const value = computeIndicator(spec, series);
  return {
    value,
    warn: (fallback) => {
      if (value !== null) return;
      ctx.warnings.push({
        kind: "insufficient_history",
        path,
        mint: shortest.mint,
        indicator: spec,
        barsNeeded: barsRequired(spec),
        barsAvailable: shortest.closes.length,
        fallback,
      });
    },
  };
}

function indexSeries(
  holdings: readonly { weight: number; closes: readonly number[] }[],
  length: number,
): number[] {
  const aligned = holdings.map((h) => h.closes.slice(h.closes.length - length));
  const index = length > 0 ? [1] : [];
  for (let i = 1; i < length; i++) {
    let dayReturn = 0;
    holdings.forEach(({ weight }, h) => {
      const closes = aligned[h]!;
      dayReturn += weight * (closes[i]! / closes[i - 1]! - 1);
    });
    index.push(index[i - 1]! * (1 + dayReturn));
  }
  return index;
}

/** Σ weights[i] × allocations[i], dropping zero-weight children. */
function combine(allocations: readonly Allocation[], weights: readonly number[]): Allocation {
  const result: Allocation = {};
  allocations.forEach((allocation, i) => {
    const weight = weights[i]!;
    if (weight === 0) return;
    for (const [mint, fraction] of Object.entries(allocation)) {
      result[mint] = (result[mint] ?? 0) + weight * fraction;
    }
  });
  return result;
}
