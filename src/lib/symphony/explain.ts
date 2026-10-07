import { getNode } from "./edit";
import { evaluateWithTrace, type TraceEntry, type TracedValue } from "./evaluate";
import { barIndexAt, type MarketData } from "./market-data";
import { describeIndicator } from "./outline";
import type { Allocation, SymphonyNode } from "./types";

/**
 * Why a symphony's target allocation changed between two dates: the tree is
 * evaluated (with evaluateWithTrace, the same code as evaluate()) on both
 * dates, and every decision is compared. Everything is labelled by token
 * symbol; numbers are only ever copied from the evaluation.
 */

type Side = { ticker: string; indicator: string; value: number | null };

export type ConditionState = {
  left: Side;
  right: number | Side;
  /** null: too little history, so the else branch was taken. */
  result: boolean | null;
  branch: "then" | "else";
};

export type ConditionChange = {
  path: string;
  /** e.g. "SOL price > SOL 50d SMA". */
  description: string;
  /** null when this condition wasn't reached on that date (inside an untaken branch). */
  before: ConditionState | null;
  now: ConditionState | null;
  changed: boolean;
};

export type FilterChange = {
  path: string;
  description: string;
  before: string[] | null;
  now: string[] | null;
  changed: boolean;
};

export type TargetChange = {
  ticker: string;
  /** Fractions of the portfolio (0–1). */
  before: number;
  now: number;
  /** now − before, in percentage points. */
  changePts: number;
};

export type SymphonyExplanation = {
  /** Daily closes the two evaluations used (null: no data on or before that date). */
  from: string | null;
  to: string | null;
  targetBefore: Record<string, number> | null;
  targetNow: Record<string, number>;
  /** Every token whose target moved, biggest move first. */
  targetChanges: TargetChange[];
  conditions: ConditionChange[];
  filters: FilterChange[];
  /** Nodes that fell back for lack of price history today. */
  shortHistory: { path: string; ticker: string; barsNeeded: number; barsAvailable: number }[];
};

const COMPARATOR = { gt: ">", gte: "≥", lt: "<", lte: "≤" } as const;
const round = (x: number, digits = 6) => Number(x.toFixed(digits));

export function explainSymphonyChange(input: {
  tree: SymphonyNode;
  data: MarketData;
  from: string;
  to: string;
  labelOf: (mint: string) => string;
}): SymphonyExplanation {
  const { tree, data, labelOf } = input;
  const toIndex = barIndexAt(data.dates, input.to);
  const fromIndex = barIndexAt(data.dates, input.from);
  const toDate = data.dates[toIndex] ?? null;
  const fromDate = data.dates[fromIndex] ?? null;

  const now = evaluateWithTrace(tree, data, input.to);
  const before = fromDate === null ? null : evaluateWithTrace(tree, data, input.from);

  const label = (allocation: Allocation) => {
    const out: Record<string, number> = {};
    for (const [mint, w] of Object.entries(allocation)) {
      const ticker = labelOf(mint);
      out[ticker] = (out[ticker] ?? 0) + w;
    }
    return out;
  };
  const targetNow = label(now.allocation);
  const targetBefore = before ? label(before.allocation) : null;
  const targetChanges = targetBefore
    ? [...new Set([...Object.keys(targetBefore), ...Object.keys(targetNow)])]
        .map((ticker) => {
          const b = targetBefore[ticker] ?? 0;
          const n = targetNow[ticker] ?? 0;
          return { ticker, before: b, now: n, changePts: round((n - b) * 100, 4) };
        })
        .filter((c) => Math.abs(c.changePts) >= 0.01)
        .sort((a, b) => Math.abs(b.changePts) - Math.abs(a.changePts))
    : [];

  const side = (v: TracedValue): Side => ({
    ticker: labelOf(v.mint),
    indicator: describeIndicator(v.indicator),
    value: v.value,
  });
  const conditionState = (e: Extract<TraceEntry, { kind: "condition" }>): ConditionState => ({
    left: side(e.left),
    right: typeof e.right === "number" ? e.right : side(e.right),
    result: e.result,
    branch: e.branch,
  });
  const describeCondition = (e: Extract<TraceEntry, { kind: "condition" }>) => {
    const s = conditionState(e);
    const r =
      typeof s.right === "number" ? String(s.right) : `${s.right.ticker} ${s.right.indicator}`;
    return `${s.left.ticker} ${s.left.indicator} ${COMPARATOR[e.comparator]} ${r}`;
  };
  const childLabel = (path: string, index: number) => {
    const child = getNode(tree, `${path}.children[${index}]`);
    if (!child) return `#${index + 1}`;
    if (child.type === "asset") return labelOf(child.mint);
    if (child.type === "group") return `"${child.name}"`;
    return `branch #${index + 1}`;
  };
  const selected = (e: Extract<TraceEntry, { kind: "filter" }>) =>
    e.children.filter((c) => c.selected).map((c) => childLabel(e.path, c.index));

  const paths = (kind: TraceEntry["kind"]) => [
    ...new Set(
      [...(before?.trace ?? []), ...now.trace].filter((e) => e.kind === kind).map((e) => e.path),
    ),
  ];
  const find = <K extends TraceEntry["kind"]>(
    trace: TraceEntry[] | undefined,
    kind: K,
    path: string,
  ) =>
    trace?.find((e): e is Extract<TraceEntry, { kind: K }> => e.kind === kind && e.path === path) ??
    null;

  const conditions = paths("condition").map((path): ConditionChange => {
    const b = find(before?.trace, "condition", path);
    const n = find(now.trace, "condition", path);
    return {
      path,
      description: describeCondition((n ?? b)!),
      before: b && conditionState(b),
      now: n && conditionState(n),
      changed: (b?.result ?? null) !== (n?.result ?? null) || (b === null) !== (n === null),
    };
  });
  const filters = paths("filter").map((path): FilterChange => {
    const b = find(before?.trace, "filter", path);
    const n = find(now.trace, "filter", path);
    const e = (n ?? b)!;
    const pickedBefore = b && selected(b);
    const pickedNow = n && selected(n);
    return {
      path,
      description: `Pick ${e.direction} ${e.count} by ${describeIndicator(e.sortBy)}`,
      before: pickedBefore,
      now: pickedNow,
      changed: JSON.stringify(pickedBefore) !== JSON.stringify(pickedNow),
    };
  });

  return {
    from: fromDate,
    to: toDate,
    targetBefore,
    targetNow,
    targetChanges,
    conditions,
    filters,
    shortHistory: now.warnings.map((w) => ({
      path: w.path,
      ticker: labelOf(w.mint),
      barsNeeded: w.barsNeeded,
      barsAvailable: w.barsAvailable,
    })),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const value = (v: number | null) =>
  v === null ? "no value (too little history)" : Number(v.toPrecision(6)).toString();

/**
 * A plain summary built only from the explanation's own fields (no model
 * involved): shown on its own when the AI isn't available, and under the AI
 * text so its figures can be checked.
 */
export function summarizeExplanation(ex: SymphonyExplanation): string[] {
  const lines: string[] = [];
  if (!ex.from) {
    lines.push(`There's no stored price history before ${ex.to ?? "today"} to compare with.`);
  }
  const flipped = ex.conditions.filter((c) => c.changed);
  for (const c of flipped) {
    const was = c.before
      ? c.before.result === null
        ? "undecided"
        : String(c.before.result)
      : "not checked";
    const is = c.now ? (c.now.result === null ? "undecided" : String(c.now.result)) : "not checked";
    const detail = c.now
      ? ` (now ${c.now.left.ticker} ${c.now.left.indicator} = ${value(c.now.left.value)}${
          typeof c.now.right === "number"
            ? ` vs ${c.now.right}`
            : ` vs ${c.now.right.ticker} ${c.now.right.indicator} = ${value(c.now.right.value)}`
        })`
      : "";
    lines.push(`"${c.description}" went from ${was} to ${is}${detail}.`);
  }
  for (const f of ex.filters.filter((x) => x.changed)) {
    lines.push(
      `${f.description} now picks ${f.now?.join(", ") || "nothing"} (was ${f.before?.join(", ") || "nothing"}).`,
    );
  }
  if (ex.from && flipped.length === 0 && ex.filters.every((f) => !f.changed)) {
    lines.push(`No condition or ranking changed since ${ex.from}.`);
  }
  if (ex.targetChanges.length > 0) {
    lines.push(
      "Target moved: " +
        ex.targetChanges.map((c) => `${c.ticker} ${pct(c.before)} → ${pct(c.now)}`).join(", ") +
        ".",
    );
  } else if (ex.from) {
    lines.push("The target allocation is unchanged.");
  }
  for (const s of ex.shortHistory) {
    lines.push(
      `${s.ticker} has ${s.barsAvailable} of the ${s.barsNeeded} days of history a rule needs, so that rule used its fallback.`,
    );
  }
  return lines;
}

export type DriftLine = {
  ticker: string;
  /** Fractions (0–1) of the portfolio's value now, and the target. */
  weight: number;
  target: number;
  /** weight − target, percentage points. */
  driftPts: number;
};

/** explainRebalance's data for a live symphony: the target change plus how far the wallet drifted. */
export type RebalanceExplanation = SymphonyExplanation & {
  /** What `from` is: the last rebalance, the day the investment started, or a week ago (drafts). */
  since: "last_rebalance" | "started" | "week_ago";
  /** Null for drafts (no wallet to compare with). */
  drift: DriftLine[] | null;
  /** The wallet's value in this symphony's tokens and USDC; null for drafts. */
  walletUsd: number | null;
};

export function summarizeRebalance(ex: RebalanceExplanation): string[] {
  const lines = summarizeExplanation(ex);
  if (ex.walletUsd !== null && ex.walletUsd < 1) {
    lines.push("Your wallet doesn't hold any of this symphony's tokens or USDC yet.");
    return lines;
  }
  const off = (ex.drift ?? []).filter((d) => Math.abs(d.driftPts) >= 0.5);
  if (off.length > 0) {
    lines.push(
      "Your wallet is off target: " +
        off.map((d) => `${d.ticker} is ${pct(d.weight)} vs ${pct(d.target)} target`).join(", ") +
        ".",
    );
  } else if (ex.drift) {
    lines.push("Your wallet is within half a point of the target everywhere.");
  }
  return lines;
}
