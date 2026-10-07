import { z } from "zod";

import { indicatorSpecSchema, symphonySchema, weightingSchema } from "./schema";
import type { AssetIndicator, IndicatorSpec, Symphony, SymphonyNode, Weighting } from "./types";
import { validateSymphony } from "./validate";

/**
 * Symphonies as the assistant reads and writes them: the same tree as
 * types.ts, but every asset is named by ticker or token symbol instead of a
 * mint. The model never sees or supplies a mint; the server resolves tickers
 * through the asset registry (toMintTree) and names mints back (toTickerTree).
 */

export type TickerIndicator = { ticker: string; indicator: IndicatorSpec };

export type TickerNode =
  | { type: "asset"; ticker: string }
  | { type: "group"; name: string; weight: Weighting; children: TickerNode[] }
  | {
      type: "if";
      condition: {
        left: TickerIndicator;
        comparator: "gt" | "gte" | "lt" | "lte";
        right: number | TickerIndicator;
      };
      then: TickerNode;
      else: TickerNode;
    }
  | {
      type: "filter";
      sortBy: IndicatorSpec;
      select: { direction: "top" | "bottom"; count: number };
      children: TickerNode[];
    };

export type TickerSymphony = { name: string; description?: string; root: TickerNode };

const ticker = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^\$?[A-Za-z0-9.]+$/, "Use a ticker or token symbol, not an address");
const tickerIndicator = z.object({ ticker, indicator: indicatorSpecSchema }).strict();

export const tickerNodeSchema: z.ZodType<TickerNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("asset"), ticker }).strict(),
    z
      .object({
        type: z.literal("group"),
        name: z.string().trim().min(1).max(80),
        weight: weightingSchema,
        children: z.array(tickerNodeSchema).min(1).max(20),
      })
      .strict(),
    z
      .object({
        type: z.literal("if"),
        condition: z
          .object({
            left: tickerIndicator,
            comparator: z.enum(["gt", "gte", "lt", "lte"]),
            right: z.union([z.number().finite(), tickerIndicator]),
          })
          .strict(),
        then: tickerNodeSchema,
        else: tickerNodeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("filter"),
        sortBy: indicatorSpecSchema,
        select: z
          .object({
            direction: z.enum(["top", "bottom"]),
            count: z.number().int().positive(),
          })
          .strict(),
        children: z.array(tickerNodeSchema).min(1).max(20),
      })
      .strict(),
  ]),
);

export const tickerSymphonySchema: z.ZodType<TickerSymphony> = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional(),
    root: tickerNodeSchema,
  })
  .strict();

/** Size limits that keep proposals readable (and requests small). */
export const MAX_NODES = 60;
export const MAX_DEPTH = 8;

/** Ticker or symbol → registry mint and its canonical symbol, or why not. */
export type ResolveTicker = (
  ticker: string,
) => { mint: string; symbol: string } | { reason: string };

export type ToMintResult =
  { ok: true; symphony: Symphony; tree: TickerSymphony } | { ok: false; errors: string[] };

/**
 * Checks a proposed ticker tree and turns it into a symphony: structure (Zod),
 * size, every ticker resolved in the registry, then the symphony's own rules
 * (validateSymphony: weights sum to 100, one per child, …). Returns every
 * problem, phrased so the model can fix it. On success `tree` is the proposal
 * with each ticker replaced by the registry's token symbol.
 */
export function toMintTree(input: unknown, resolve: ResolveTicker): ToMintResult {
  const parsed = tickerSymphonySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: [z.prettifyError(parsed.error)] };
  const proposal = parsed.data;

  const errors: string[] = [];
  let nodes = 0;
  const resolveAt = (path: string, name: string) => {
    const found = resolve(name);
    if ("reason" in found) {
      errors.push(`${path}: ${found.reason}`);
      return null;
    }
    return found;
  };
  const indicator = (path: string, ref: TickerIndicator) => {
    const found = resolveAt(path, ref.ticker);
    return (
      found && {
        mint: { mint: found.mint, indicator: ref.indicator } satisfies AssetIndicator,
        symbol: { ticker: found.symbol, indicator: ref.indicator },
      }
    );
  };
  const convert = (
    node: TickerNode,
    path: string,
    depth: number,
  ): { mint: SymphonyNode; symbol: TickerNode } | null => {
    nodes++;
    if (depth > MAX_DEPTH) {
      errors.push(`${path}: nested deeper than ${MAX_DEPTH} levels; flatten the tree`);
      return null;
    }
    switch (node.type) {
      case "asset": {
        const found = resolveAt(path, node.ticker);
        return (
          found && {
            mint: { type: "asset", mint: found.mint },
            symbol: { type: "asset", ticker: found.symbol },
          }
        );
      }
      case "group":
      case "filter": {
        const children = node.children.map((child, i) =>
          convert(child, `${path}.children[${i}]`, depth + 1),
        );
        if (children.some((c) => c === null)) return null;
        const kids = children as { mint: SymphonyNode; symbol: TickerNode }[];
        return node.type === "group"
          ? {
              mint: { ...node, children: kids.map((k) => k.mint) },
              symbol: { ...node, children: kids.map((k) => k.symbol) },
            }
          : {
              mint: { ...node, children: kids.map((k) => k.mint) },
              symbol: { ...node, children: kids.map((k) => k.symbol) },
            };
      }
      case "if": {
        const { left, comparator, right } = node.condition;
        const l = indicator(`${path}.condition.left`, left);
        const r = typeof right === "number" ? right : indicator(`${path}.condition.right`, right);
        const then = convert(node.then, `${path}.then`, depth + 1);
        const otherwise = convert(node.else, `${path}.else`, depth + 1);
        if (!l || r === null || !then || !otherwise) return null;
        return {
          mint: {
            type: "if",
            condition: { left: l.mint, comparator, right: typeof r === "number" ? r : r.mint },
            then: then.mint,
            else: otherwise.mint,
          },
          symbol: {
            type: "if",
            condition: { left: l.symbol, comparator, right: typeof r === "number" ? r : r.symbol },
            then: then.symbol,
            else: otherwise.symbol,
          },
        };
      }
    }
  };

  const root = convert(proposal.root, "root", 1);
  if (nodes > MAX_NODES) errors.push(`The tree has ${nodes} nodes; keep it under ${MAX_NODES}`);
  if (!root || errors.length > 0) return { ok: false, errors };

  const symphony = symphonySchema.parse({
    version: 1,
    name: proposal.name,
    ...(proposal.description ? { description: proposal.description } : {}),
    root: root.mint,
  });
  // Every mint came from the registry; this checks the tree's own rules.
  const issues = validateSymphony(symphony, { isKnownMint: () => true });
  if (issues.length > 0) return { ok: false, errors: issues.map((i) => `${i.path}: ${i.message}`) };
  return {
    ok: true,
    symphony,
    tree: {
      name: proposal.name,
      ...(proposal.description ? { description: proposal.description } : {}),
      root: root.symbol,
    },
  };
}

/** A label for every mint; tokens outside the registry are never shown by mint. */
export const UNLISTED = "UNLISTED";

/** A stored symphony as the assistant (or a diff) sees it: symbols, never mints. */
export function toTickerTree(
  symphony: Symphony,
  symbolOf: (mint: string) => string | null,
): TickerSymphony {
  const label = (mint: string) => symbolOf(mint) ?? UNLISTED;
  const ref = ({ mint, indicator }: AssetIndicator): TickerIndicator => ({
    ticker: label(mint),
    indicator,
  });
  const visit = (node: SymphonyNode): TickerNode => {
    switch (node.type) {
      case "asset":
        return { type: "asset", ticker: label(node.mint) };
      case "group":
        return { ...node, children: node.children.map(visit) };
      case "filter":
        return { ...node, children: node.children.map(visit) };
      case "if": {
        const { left, comparator, right } = node.condition;
        return {
          type: "if",
          condition: {
            left: ref(left),
            comparator,
            right: typeof right === "number" ? right : ref(right),
          },
          then: visit(node.then),
          else: visit(node.else),
        };
      }
    }
  };
  return {
    name: symphony.name,
    ...(symphony.description ? { description: symphony.description } : {}),
    root: visit(symphony.root),
  };
}
