import type { IndicatorSpec, Weighting } from "./types";
import type { TickerIndicator, TickerNode, TickerSymphony } from "./ticker-tree";

/**
 * A symphony as indented plain-language lines, for previews and for diffing a
 * suggested change against the current tree. Works on ticker trees so it
 * never shows a mint.
 */

export type OutlineLine = { depth: number; text: string };

export function describeIndicator(spec: IndicatorSpec): string {
  switch (spec.fn) {
    case "price":
      return "price";
    case "sma":
      return `${spec.period}d SMA`;
    case "ema":
      return `${spec.period}d EMA`;
    case "rsi":
      return `${spec.period}d RSI`;
    case "cumulativeReturn":
      return `${spec.period}d return`;
    case "maxDrawdown":
      return `${spec.period}d max drawdown`;
    case "stdevReturn":
      return `${spec.period}d volatility`;
  }
}

const COMPARATOR = { gt: ">", gte: "≥", lt: "<", lte: "≤" } as const;

const side = (ref: TickerIndicator | number) =>
  typeof ref === "number" ? String(ref) : `${ref.ticker} ${describeIndicator(ref.indicator)}`;

function describeWeight(weight: Weighting): string {
  switch (weight.method) {
    case "equal":
      return "equal weight";
    case "specified":
      return "weights " + weight.percentages.map((p) => `${p}%`).join(" / ");
    case "inverseVolatility":
      return `inverse volatility (${weight.lookbackDays}d)`;
  }
}

export function outline(symphony: TickerSymphony): OutlineLine[] {
  const lines: OutlineLine[] = [];
  const visit = (node: TickerNode, depth: number, prefix = "") => {
    switch (node.type) {
      case "asset":
        lines.push({ depth, text: `${prefix}${node.ticker}` });
        return;
      case "group":
        lines.push({
          depth,
          text: `${prefix}Group "${node.name}" · ${describeWeight(node.weight)}`,
        });
        node.children.forEach((child, i) => {
          const pct = node.weight.method === "specified" ? node.weight.percentages[i] : undefined;
          visit(child, depth + 1, pct === undefined ? "" : `${pct}% `);
        });
        return;
      case "filter":
        lines.push({
          depth,
          text: `${prefix}Pick ${node.select.direction} ${node.select.count} by ${describeIndicator(node.sortBy)}`,
        });
        node.children.forEach((child) => visit(child, depth + 1));
        return;
      case "if": {
        const { left, comparator, right } = node.condition;
        lines.push({
          depth,
          text: `${prefix}If ${side(left)} ${COMPARATOR[comparator]} ${side(right)}`,
        });
        visit(node.then, depth + 1, "then: ");
        visit(node.else, depth + 1, "else: ");
        return;
      }
    }
  };
  lines.push({ depth: 0, text: symphony.name });
  visit(symphony.root, 1);
  return lines;
}

export type DiffLine = OutlineLine & { change: "same" | "added" | "removed" };

const key = (line: OutlineLine) => `${line.depth}|${line.text}`;

/** Line diff (longest common subsequence) of two outlines. */
export function diffOutlines(before: OutlineLine[], after: OutlineLine[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        key(before[i]!) === key(after[j]!)
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(before[i]!) === key(after[j]!)) {
      out.push({ ...before[i]!, change: "same" });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ ...before[i++]!, change: "removed" });
    } else {
      out.push({ ...after[j++]!, change: "added" });
    }
  }
  while (i < n) out.push({ ...before[i++]!, change: "removed" });
  while (j < m) out.push({ ...after[j++]!, change: "added" });
  return out;
}
