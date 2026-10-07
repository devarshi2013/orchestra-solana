import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { Asset } from "@/lib/assets/registry";
import type { BacktestSummary, SymphonyListItem } from "@/lib/assistant/views";
import { BacktestError, runBacktest as simulate } from "@/lib/backtest/engine";
import type { BacktestConfig, RebalanceRule } from "@/lib/backtest/types";
import { describeRule } from "@/lib/invest/schedule";
import { loadDailyMarketData, trackMints } from "@/lib/market/store";
import { barsNeeded } from "@/lib/symphony/evaluate";
import {
  explainSymphonyChange,
  summarizeRebalance,
  type RebalanceExplanation,
} from "@/lib/symphony/explain";
import { barIndexAt, type MarketData } from "@/lib/symphony/market-data";
import { collectMints } from "@/lib/symphony/mints";
import { symphonySchema } from "@/lib/symphony/schema";
import {
  tickerSymphonySchema,
  toMintTree,
  toTickerTree,
  type ResolveTicker,
  type TickerSymphony,
} from "@/lib/symphony/ticker-tree";
import type { Symphony } from "@/lib/symphony/types";
import { SOL_MINT } from "@/lib/tokens";
import { getRegistry } from "@/server/assets/registry";
import { db } from "@/server/db";
import { snapshot } from "@/server/invest/service";

import { resolveAsset } from "./resolve";
import type { ToolResult } from "./tools";

/**
 * Symphony tools for the assistant: propose a symphony, read the user's own,
 * backtest, and explain a rebalance. Trees go in and out with tickers only;
 * mints come from the asset registry. Nothing here saves or trades: a
 * proposal is only stored when the user opens it in the editor.
 */

const ok = <T>(data: T): ToolResult<T> => ({ data, reason: null });
const fail = <T>(reason: string): ToolResult<T> => ({ data: null, reason });
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The registry as the symphony tools use it: ticker → mint, mint → symbol. */
export async function registryLookup(): Promise<{
  resolve: ResolveTicker;
  symbolOf: (mint: string) => string | null;
}> {
  const registry = await getRegistry();
  const assets: Asset[] = [...registry.stocks, ...registry.crypto];
  const byMint = new Map(assets.map((a) => [a.mint, a.symbol]));
  return {
    resolve: (ticker) => {
      const found = resolveAsset(assets, ticker);
      return "asset" in found
        ? { mint: found.asset.mint, symbol: found.asset.symbol }
        : { reason: found.reason };
    },
    symbolOf: (mint) => byMint.get(mint) ?? null,
  };
}

// --- runBacktest --------------------------------------------------------------

export const PERIOD_DAYS = { "3M": 91, "6M": 182, "1Y": 365, max: null } as const;
export type Period = keyof typeof PERIOD_DAYS;
const periodSchema = z.enum(["3M", "6M", "1Y", "max"]);

/** The editor's backtest settings, so the assistant's numbers match what users see there. */
const SETTINGS = {
  rebalance: { kind: "weekly" } as RebalanceRule,
  startingCapitalUsdc: 1000,
  feeBps: 10,
  slippageBps: 20,
};

const round = (x: number | null, digits = 4) => (x === null ? null : Number(x.toFixed(digits)));

/** Runs the backtester on stored daily closes; the summary is the backtester's own numbers. */
export async function backtestSymphony(
  symphony: Symphony,
  period: Period,
  symbolOf: (mint: string) => string | null,
  load: (mints: string[]) => Promise<MarketData> = loadDailyMarketData,
): Promise<ToolResult<BacktestSummary>> {
  const mints = [...collectMints(symphony.root)];
  let data: MarketData;
  try {
    data = await load([...new Set([...mints, SOL_MINT])]);
  } catch (error) {
    return fail(`Couldn't load price history: ${message(error)}`);
  }
  const last = data.dates.length - 1;
  if (last < 1) {
    await trackMints(mints).catch(() => {});
    return fail(
      "No stored price history for these assets yet; the daily price sync will start collecting it.",
    );
  }
  const endDate = data.dates[last]!;
  const warmUp = data.dates[Math.min(Math.max(barsNeeded(symphony.root), 1), last)]!;
  const days = PERIOD_DAYS[period];
  const periodStart =
    days === null
      ? warmUp
      : new Date(Date.parse(`${endDate}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const config: BacktestConfig = {
    startDate: periodStart > warmUp ? periodStart : warmUp,
    endDate,
    ...SETTINGS,
  };
  let result;
  try {
    result = simulate(symphony, data, config);
  } catch (error) {
    if (error instanceof BacktestError) return fail(error.message);
    throw error;
  }
  const from = result.equity[1]?.date ?? config.startDate;
  const startIndex = barIndexAt(data.dates, from);
  const shortHistory = mints
    .map((mint) => {
      const closes = data.closes[mint] ?? [];
      const first = closes.findIndex((c) => typeof c === "number" && c > 0);
      return { mint, first };
    })
    .filter(({ first }) => first === -1 || first > startIndex)
    .map(({ mint, first }) => ({
      ticker: symbolOf(mint) ?? "UNLISTED",
      firstDate: first === -1 ? null : data.dates[first]!,
    }));
  return ok({
    period,
    from,
    to: endDate,
    tradingDays: result.equity.length - 1,
    totalReturn: round(result.metrics.totalReturn)!,
    cagr: round(result.metrics.cagr)!,
    maxDrawdown: round(result.metrics.maxDrawdown)!,
    volatility: round(result.metrics.volatility),
    sharpe: round(result.metrics.sharpe, 2),
    solTotalReturn: round(result.benchmark?.totalReturn ?? null),
    rebalances: result.rebalances.length,
    totalCostUsdc: Number(result.totalCost.toFixed(2)),
    settings: {
      startingCapitalUsdc: SETTINGS.startingCapitalUsdc,
      rebalance: describeRule(SETTINGS.rebalance),
      feeBps: SETTINGS.feeBps,
      slippageBps: SETTINGS.slippageBps,
    },
    shortHistory,
  });
}

// --- createSymphony -----------------------------------------------------------

export const createSymphonyInput = z
  .object({ symphony: z.unknown(), period: periodSchema.optional() })
  .strict();

export type CreatedSymphony =
  | {
      ok: true;
      tree: TickerSymphony;
      symphony: Symphony;
      backtest: BacktestSummary | null;
      backtestNote: string | null;
    }
  | { ok: false; errors: string[] };

/**
 * Checks a proposed symphony (ticker tree) against the symphony schema, its
 * rules and the asset registry, then backtests it. Unknown or ambiguous
 * tickers, bad weights and oversized trees are rejected with fixable errors.
 * Never saves anything.
 */
export async function createSymphony(input: unknown): Promise<CreatedSymphony> {
  const args = createSymphonyInput.safeParse(input);
  if (!args.success) return { ok: false, errors: [z.prettifyError(args.error)] };
  let lookup;
  try {
    lookup = await registryLookup();
  } catch (error) {
    return { ok: false, errors: [`Asset registry unavailable: ${message(error)}`] };
  }
  const converted = toMintTree(args.data.symphony, lookup.resolve);
  if (!converted.ok) return converted;
  const backtest = await backtestSymphony(
    converted.symphony,
    args.data.period ?? "1Y",
    lookup.symbolOf,
  ).catch((error: unknown) => fail<BacktestSummary>(`Backtest failed: ${message(error)}`));
  return {
    ok: true,
    tree: converted.tree,
    symphony: converted.symphony,
    backtest: backtest.data,
    backtestNote: backtest.reason,
  };
}

// --- reading the user's symphonies -------------------------------------------

type Owned =
  | {
      kind: "investment";
      id: string;
      name: string;
      symphony: Symphony;
      status: string;
      rule: RebalanceRule;
      lastRebalancedAt: Date | null;
      createdAt: Date;
      row: Prisma.InvestmentGetPayload<object>;
    }
  | { kind: "draft"; id: string; name: string; symphony: Symphony; updatedAt: Date };

const UUID = z.uuid();

/** One of `wallet`'s symphonies (investment or owned draft), or null. */
export async function findOwnedSymphony(id: string, wallet: string): Promise<Owned | null> {
  if (!UUID.safeParse(id).success) return null;
  const investment = await db.investment.findUnique({ where: { id } });
  if (investment && investment.owner === wallet) {
    return {
      kind: "investment",
      id,
      name: investment.name,
      symphony: symphonySchema.parse(investment.symphony),
      status: investment.status,
      rule: investment.rebalance as RebalanceRule,
      lastRebalancedAt: investment.lastRebalancedAt,
      createdAt: investment.createdAt,
      row: investment,
    };
  }
  const draft = await db.symphonyDraft.findUnique({ where: { id } });
  if (draft && draft.owner === wallet) {
    const parsed = symphonySchema.safeParse(draft.symphony);
    if (!parsed.success) return null;
    return {
      kind: "draft",
      id,
      name: draft.name,
      symphony: parsed.data,
      updatedAt: draft.updatedAt,
    };
  }
  return null;
}

export async function listMySymphonies(wallet: string): Promise<ToolResult<SymphonyListItem[]>> {
  try {
    const [investments, drafts] = await Promise.all([
      db.investment.findMany({
        where: { owner: wallet, status: { not: "closed" } },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
      db.symphonyDraft.findMany({
        where: { owner: wallet },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
    ]);
    return ok([
      ...investments.map((i) => ({
        id: i.id,
        kind: "investment" as const,
        name: i.name,
        status: i.status,
        updatedAt: i.updatedAt.toISOString(),
      })),
      ...drafts.map((d) => ({
        id: d.id,
        kind: "draft" as const,
        name: d.name,
        status: null,
        updatedAt: d.updatedAt.toISOString(),
      })),
    ]);
  } catch (error) {
    return fail(`Couldn't list symphonies: ${message(error)}`);
  }
}

export const symphonyIdInput = z.object({ symphonyId: z.string().trim().min(1) }).strict();

export async function getSymphony(
  input: unknown,
  wallet: string,
): Promise<
  ToolResult<{
    id: string;
    kind: "draft" | "investment";
    name: string;
    status: string | null;
    rebalance: string | null;
    symphony: TickerSymphony;
  }>
> {
  const args = symphonyIdInput.safeParse(input);
  if (!args.success) return fail(`Invalid input: ${z.prettifyError(args.error)}`);
  const [found, lookup] = await Promise.all([
    findOwnedSymphony(args.data.symphonyId, wallet),
    registryLookup(),
  ]);
  if (!found)
    return fail("No symphony with that id among this user's symphonies (use listMySymphonies)");
  return ok({
    id: found.id,
    kind: found.kind,
    name: found.name,
    status: found.kind === "investment" ? found.status : null,
    rebalance: found.kind === "investment" ? describeRule(found.rule) : null,
    symphony: toTickerTree(found.symphony, lookup.symbolOf),
  });
}

export const runBacktestInput = z
  .object({
    symphonyId: z.string().trim().min(1).optional(),
    symphony: tickerSymphonySchema.optional(),
    period: periodSchema,
  })
  .strict()
  .refine((v) => (v.symphonyId === undefined) !== (v.symphony === undefined), {
    message: "Give exactly one of symphonyId or symphony",
  });

/** Backtests one of the user's symphonies, or a ticker tree (checked like createSymphony). */
export async function runSymphonyBacktest(
  input: unknown,
  wallet: string,
): Promise<ToolResult<BacktestSummary & { name: string }>> {
  const args = runBacktestInput.safeParse(input);
  if (!args.success) return fail(`Invalid input: ${z.prettifyError(args.error)}`);
  const lookup = await registryLookup();
  let symphony: Symphony;
  let name: string;
  if (args.data.symphonyId) {
    const found = await findOwnedSymphony(args.data.symphonyId, wallet);
    if (!found) return fail("No symphony with that id among this user's symphonies");
    symphony = found.symphony;
    name = found.name;
  } else {
    const converted = toMintTree(args.data.symphony, lookup.resolve);
    if (!converted.ok) return fail(`Invalid symphony: ${converted.errors.join("; ")}`);
    symphony = converted.symphony;
    name = symphony.name;
  }
  const result = await backtestSymphony(symphony, args.data.period, lookup.symbolOf);
  return result.data ? ok({ name, ...result.data }) : fail(result.reason);
}

// --- explainRebalance ---------------------------------------------------------

/** Drafts are compared with a week ago; investments with their last rebalance. */
const DRAFT_LOOKBACK_DAYS = 7;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Why the target allocation changed: the symphony evaluated (evaluate()'s own
 * trace) at the last rebalance (or a week ago, for drafts) and on the latest
 * close, plus, for an investment, how far the wallet drifted from the target.
 */
export async function explainRebalance(
  input: unknown,
  wallet: string,
): Promise<ToolResult<RebalanceExplanation & { name: string; summary: string[] }>> {
  const args = symphonyIdInput.safeParse(input);
  if (!args.success) return fail(`Invalid input: ${z.prettifyError(args.error)}`);
  const [found, lookup] = await Promise.all([
    findOwnedSymphony(args.data.symphonyId, wallet),
    registryLookup(),
  ]);
  if (!found) return fail("No symphony with that id among this user's symphonies");
  const label = (mint: string) => lookup.symbolOf(mint) ?? "UNLISTED";
  let data: MarketData;
  try {
    data = await loadDailyMarketData([...collectMints(found.symphony.root)]);
  } catch (error) {
    return fail(`Couldn't load price history: ${message(error)}`);
  }
  if (data.dates.length === 0)
    return fail("No stored price history for this symphony's assets yet");
  const to = data.dates[data.dates.length - 1]!;
  const fromDate =
    found.kind === "investment"
      ? (found.lastRebalancedAt ?? found.createdAt)
      : new Date(Date.parse(`${to}T00:00:00Z`) - DRAFT_LOOKBACK_DAYS * 86_400_000);
  const explanation = explainSymphonyChange({
    tree: found.symphony.root,
    data,
    from: isoDay(fromDate),
    to,
    labelOf: label,
  });

  let drift: RebalanceExplanation["drift"] = null;
  let walletUsd: number | null = null;
  if (found.kind === "investment") {
    const snap = await snapshot(found.row).catch(() => null);
    walletUsd = snap ? Number(snap.plan.totalUsd.toFixed(2)) : null;
    drift =
      snap?.plan.positions.map((p) => ({
        ticker: label(p.mint),
        weight: Number(p.weight.toFixed(6)),
        target: Number(p.targetWeight.toFixed(6)),
        driftPts: Number(((p.weight - p.targetWeight) * 100).toFixed(2)),
      })) ?? null;
  }
  const since: RebalanceExplanation["since"] =
    found.kind === "draft" ? "week_ago" : found.lastRebalancedAt ? "last_rebalance" : "started";
  const full = { ...explanation, since, drift, walletUsd };
  return ok({ name: found.name, ...full, summary: summarizeRebalance(full) });
}
