import { barsRequired, computeIndicator } from "./indicators";
import { barIndexAt, closesWindow, type MarketData } from "./market-data";
import type {
  Allocation,
  AssetIndicator,
  Condition,
  FilterNode,
  GroupNode,
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

type Context = { data: MarketData; date: string; index: number };

/**
 * The allocation `tree` asks for on `date` (ISO YYYY-MM-DD), using only closes
 * on or before that date. Pure and deterministic: same inputs, same output,
 * no clock, randomness or mutation.
 *
 * Weights are fractions summing to 1; a mint reached through several branches
 * gets the sum. Only the taken branch of an `if` is evaluated, so the other
 * branch may lack data. Throws InsufficientDataError when an indicator needs
 * more history than `marketData` has (see `barsNeeded` for the warm-up).
 *
 * A composite child of a filter or inverse-volatility group is measured on its
 * current allocation held at constant weights over the lookback. A child that
 * resolves to a single mint uses that mint's own closes.
 */
export function evaluate(tree: SymphonyNode, marketData: MarketData, date: string): Allocation {
  return evaluateNode(tree, { data: marketData, date, index: barIndexAt(marketData.dates, date) });
}

/** Daily bars of history `tree` may need on any date, i.e. the backtest warm-up. */
export function barsNeeded(tree: SymphonyNode): number {
  switch (tree.type) {
    case "asset":
      return 0;
    case "group": {
      const own = tree.weight.method === "inverseVolatility" ? tree.weight.lookbackDays + 1 : 0;
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

function evaluateNode(node: SymphonyNode, ctx: Context): Allocation {
  switch (node.type) {
    case "asset":
      return { [node.mint]: 1 };
    case "if":
      return evaluateNode(isTrue(node.condition, ctx) ? node.then : node.else, ctx);
    case "group":
      return evaluateGroup(node, ctx);
    case "filter":
      return evaluateFilter(node, ctx);
  }
}

function evaluateGroup(node: GroupNode, ctx: Context): Allocation {
  const allocations = evaluateChildren(node, ctx);
  const { weight } = node;
  switch (weight.method) {
    case "equal":
      return combine(
        allocations,
        allocations.map(() => 1 / allocations.length),
      );
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
      const stdev = { fn: "stdevReturn", period: weight.lookbackDays } as const;
      const vols = allocations.map((a) =>
        computeIndicator(stdev, seriesOf(a, barsRequired(stdev), ctx)),
      );
      return combine(allocations, inverseVolatilityWeights(vols));
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

function evaluateFilter(node: FilterNode, ctx: Context): Allocation {
  const allocations = evaluateChildren(node, ctx);
  const bars = barsRequired(node.sortBy);
  const sign = node.select.direction === "top" ? -1 : 1;
  const ranked = allocations
    .map((allocation, index) => ({
      allocation,
      index,
      score: computeIndicator(node.sortBy, seriesOf(allocation, bars, ctx)),
    }))
    // Ties keep tree order, so the result never depends on sort internals.
    .sort((a, b) => sign * (a.score - b.score) || a.index - b.index)
    .slice(0, node.select.count);
  return combine(
    ranked.map((r) => r.allocation),
    ranked.map(() => 1 / ranked.length),
  );
}

function evaluateChildren(node: GroupNode | FilterNode, ctx: Context): Allocation[] {
  if (node.children.length === 0) {
    const label = node.type === "group" ? `Group "${node.name}"` : "Filter";
    throw new SymphonyEvaluationError(`${label} has no children`);
  }
  return node.children.map((child) => evaluateNode(child, ctx));
}

function isTrue({ left, comparator, right }: Condition, ctx: Context): boolean {
  const a = indicatorValue(left, ctx);
  const b = typeof right === "number" ? right : indicatorValue(right, ctx);
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

function indicatorValue({ mint, indicator }: AssetIndicator, ctx: Context): number {
  const bars = barsRequired(indicator);
  return computeIndicator(indicator, closesWindow(ctx.data, mint, ctx.index, bars, ctx.date));
}

/**
 * Price series of an allocation over the last `bars` days: the mint's closes
 * for a single-mint allocation, otherwise a constant-weight index starting at 1.
 */
function seriesOf(allocation: Allocation, bars: number, ctx: Context): number[] {
  const holdings = Object.entries(allocation).map(([mint, weight]) => ({
    weight,
    closes: closesWindow(ctx.data, mint, ctx.index, bars, ctx.date),
  }));
  if (holdings.length === 1) return holdings[0]!.closes;
  const index = [1];
  for (let i = 1; i < bars; i++) {
    let dayReturn = 0;
    for (const { weight, closes } of holdings)
      dayReturn += weight * (closes[i]! / closes[i - 1]! - 1);
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
