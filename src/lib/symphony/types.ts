/**
 * The symphony DSL: a portfolio strategy as a tree. Leaves are assets; inner
 * nodes decide how much of their parent's weight each child gets. Evaluating
 * the tree on a date yields an allocation (see evaluate.ts).
 *
 * Plain JSON-compatible data so it can be stored, diffed and edited in a UI.
 * Runtime shapes live in schema.ts; semantic rules in validate.ts.
 */

import type { IndicatorSpec } from "@/lib/indicators/types";

export type { IndicatorFn, IndicatorSpec } from "@/lib/indicators/types";

/** An indicator applied to a specific asset, e.g. SMA(50) of SOL. */
export type AssetIndicator = { mint: string; indicator: IndicatorSpec };

export type Comparator = "gt" | "gte" | "lt" | "lte";

/** `left comparator right`; the right side is a constant or another indicator. */
export type Condition = {
  left: AssetIndicator;
  comparator: Comparator;
  right: number | AssetIndicator;
};

/**
 * How a group splits its weight between its children.
 * - equal: 1/n each.
 * - specified: `percentages[i]` for child i; must sum to 100.
 * - inverseVolatility: proportional to 1 / stdev of daily returns over the
 *   lookback, so calmer children get more weight.
 */
export type Weighting =
  | { method: "equal" }
  | { method: "specified"; percentages: number[] }
  | { method: "inverseVolatility"; lookbackDays: number };

export type AssetNode = { type: "asset"; mint: string };

export type GroupNode = {
  type: "group";
  name: string;
  weight: Weighting;
  children: SymphonyNode[];
};

/** Takes the whole weight down one branch depending on `condition`. */
export type IfNode = {
  type: "if";
  condition: Condition;
  then: SymphonyNode;
  else: SymphonyNode;
};

/**
 * Ranks children by `sortBy` and keeps the top or bottom `count`, equally
 * weighted. Asset children are ranked on their own price series; composite
 * children on their current allocation's series. Children too new to measure
 * rank last (see evaluate.ts).
 */
export type FilterNode = {
  type: "filter";
  sortBy: IndicatorSpec;
  select: { direction: "top" | "bottom"; count: number };
  children: SymphonyNode[];
};

export type SymphonyNode = AssetNode | GroupNode | IfNode | FilterNode;

export type Symphony = {
  version: 1;
  name: string;
  description?: string;
  root: SymphonyNode;
};

/** Mint → fraction of the portfolio. Fractions are positive and sum to 1. */
export type Allocation = Record<string, number>;
