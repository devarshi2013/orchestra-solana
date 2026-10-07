import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { rebalanceRuleSchema, type RebalanceRule } from "@/lib/backtest/types";
import {
  planRebalance,
  realizedPrice,
  sizeLeg,
  toUnits,
  type Balance,
  type RebalancePlan,
} from "@/lib/invest/plan";
import { canQuoteLeg, deriveRunStatus } from "@/lib/invest/run-state";
import { nextDueAt } from "@/lib/invest/schedule";
import { loadDailyMarketData } from "@/lib/market/store";
import { evaluateWithWarnings, type EvaluationWarning } from "@/lib/symphony/evaluate";
import { collectMints } from "@/lib/symphony/mints";
import { symphonySchema } from "@/lib/symphony/schema";
import type { Allocation, Symphony } from "@/lib/symphony/types";
import { classifyExecuteResult, classifyOrderError } from "@/lib/swap/errors";
import { USDC_MINT } from "@/lib/tokens";
import { listedAssets } from "@/server/assets/registry";
import { db } from "@/server/db";
import { JupiterApiError } from "@/server/jupiter/client";
import { getUsdPrices } from "@/server/jupiter/price";
import { executeOrder, getOrder } from "@/server/jupiter/swap";
import { checkSignedOrder } from "@/server/solana/signed-order";
import {
  getMintDecimals,
  getTransactionOutcome,
  getWalletBalances,
  walletDeltas,
} from "@/server/solana/rpc";

/**
 * Live symphonies: planning, leg-by-leg execution and its records. The wallet
 * signs every swap in the browser; this module sizes, quotes, checks and
 * records them (docs/invest.md).
 */

export class InvestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "InvestError";
  }
}

type InvestmentRow = Prisma.InvestmentGetPayload<object>;
const OPEN_RUN = ["planned", "executing", "partial"] as const;
/** A leg still "executing" after this long is looked up on-chain. */
const RECONCILE_AFTER_MS = 60_000;
/** Without a confirmation by then, an aggregator transaction has expired. */
const GIVE_UP_AFTER_MS = 180_000;

export async function getOwnedInvestment(id: string, owner: string): Promise<InvestmentRow> {
  const investment = await db.investment.findUnique({ where: { id } });
  if (!investment || investment.owner !== owner) throw new InvestError(404, "Investment not found");
  return investment;
}

export const symphonyOf = (investment: InvestmentRow): Symphony =>
  symphonySchema.parse(investment.symphony);
export const ruleOf = (investment: InvestmentRow): RebalanceRule =>
  rebalanceRuleSchema.parse(investment.rebalance);
/** The portfolio: the symphony's mints plus USDC. */
export const universeOf = (symphony: Symphony) => [
  ...new Set([...collectMints(symphony.root), USDC_MINT]),
];

export type Snapshot = {
  balances: Record<string, Balance>;
  prices: Record<string, number>;
  target: Allocation;
  warnings: EvaluationWarning[];
  /** Daily close the target was evaluated on. */
  asOf: string | null;
  plan: RebalancePlan;
};

/** Wallet balances + spot prices + today's target → the plan, as of now. */
export async function snapshot(investment: InvestmentRow): Promise<Snapshot> {
  const symphony = symphonyOf(investment);
  const universe = universeOf(symphony);
  const [allBalances, prices, data] = await Promise.all([
    getWalletBalances(investment.owner),
    getUsdPrices(universe.filter((mint) => mint !== USDC_MINT)),
    loadDailyMarketData(universe),
  ]);
  const balances = Object.fromEntries(
    universe.filter((mint) => allBalances[mint]).map((mint) => [mint, allBalances[mint]!]),
  );
  const asOf = data.dates[data.dates.length - 1] ?? null;
  const { allocation, warnings } = evaluateWithWarnings(symphony.root, data, asOf ?? "");
  const plan = planRebalance({
    balances,
    prices,
    target: allocation,
    universe,
    driftThresholdPct: investment.driftThresholdPct,
  });
  return { balances, prices, target: allocation, warnings, asOf, plan };
}

/** Largest gap between a holding's weight and its target, in percentage points. */
export const maxDriftPct = (plan: RebalancePlan) =>
  Math.max(0, ...plan.positions.map((p) => Math.abs(p.weight - p.targetWeight) * 100));

const runInclude = { legs: { orderBy: { index: "asc" } } } as const;
export type RunWithLegs = Prisma.RebalanceRunGetPayload<{ include: typeof runInclude }>;

export async function getOwnedRun(runId: string, owner: string) {
  const run = await db.rebalanceRun.findUnique({
    where: { id: runId },
    include: { ...runInclude, investment: true },
  });
  if (!run || run.investment.owner !== owner) throw new InvestError(404, "Rebalance not found");
  return run;
}

/**
 * Starts a rebalance from a fresh snapshot. Only one run per investment may be
 * open; returns no run when nothing needs trading.
 */
export async function createRun(
  investment: InvestmentRow,
): Promise<{ run: RunWithLegs | null; snapshot: Snapshot }> {
  if (investment.status === "closed") throw new InvestError(409, "This investment is closed");
  const open = await db.rebalanceRun.findFirst({
    where: { investmentId: investment.id, status: { in: [...OPEN_RUN] } },
  });
  if (open) throw new InvestError(409, "A rebalance is already open; resume or cancel it first");

  // A token delisted since investing is never traded into or out of automatically.
  const { isListed } = await listedAssets();
  const unlisted = universeOf(symphonyOf(investment)).filter((mint) => !isListed(mint));
  if (unlisted.length > 0) {
    throw new InvestError(
      409,
      `No longer in the asset registry: ${unlisted.join(", ")}. Update the symphony before rebalancing.`,
    );
  }

  const snap = await snapshot(investment);
  if (snap.plan.legs.length === 0) return { run: null, snapshot: snap };
  const run = await db.rebalanceRun.create({
    data: {
      investmentId: investment.id,
      plan: snap as unknown as Prisma.InputJsonValue,
      legs: {
        create: snap.plan.legs.map((leg, index) => ({
          index,
          side: leg.side,
          mint: leg.mint,
          inputMint: leg.side === "sell" ? leg.mint : USDC_MINT,
          outputMint: leg.side === "sell" ? USDC_MINT : leg.mint,
          plannedUsd: leg.usd,
          plannedAmount: leg.amount,
          full: leg.full,
        })),
      },
    },
    include: runInclude,
  });
  return { run, snapshot: snap };
}

/** Recomputes the run's status from its legs; finalizes the investment when complete. */
async function settleRun(runId: string): Promise<RunWithLegs> {
  const run = await db.rebalanceRun.findUniqueOrThrow({
    where: { id: runId },
    include: { ...runInclude, investment: true },
  });
  if (run.status === "cancelled") return run;
  const status = deriveRunStatus(run.legs);
  const completed = status === "completed";
  const updated = await db.rebalanceRun.update({
    where: { id: runId },
    data: { status, completedAt: completed ? new Date() : null },
    include: runInclude,
  });
  if (completed) await recordHoldings(run.investment, true);
  return updated;
}

/** Saves the portfolio's current holdings; after a completed run, also reschedules and clears notices. */
export async function recordHoldings(
  investment: InvestmentRow,
  rebalanced: boolean,
): Promise<void> {
  const universe = universeOf(symphonyOf(investment));
  const balances = await getWalletBalances(investment.owner);
  const holdings = Object.fromEntries(
    universe
      .filter((mint) => balances[mint])
      .map((mint) => [mint, toUnits(balances[mint]!.amount, balances[mint]!.decimals)]),
  );
  const now = new Date();
  await db.investment.update({
    where: { id: investment.id },
    data: {
      holdings,
      holdingsAt: now,
      ...(rebalanced
        ? { lastRebalancedAt: now, nextDueAt: nextDueAt(ruleOf(investment), now) }
        : {}),
    },
  });
  if (rebalanced) {
    await db.notification.updateMany({
      where: { investmentId: investment.id, readAt: null },
      data: { readAt: now },
    });
  }
}

/**
 * Looks up legs stuck in "executing" (the browser or our call to Jupiter died
 * mid-flight) on-chain, and records what actually happened.
 */
export async function reconcileRun(runId: string): Promise<void> {
  const run = await db.rebalanceRun.findUniqueOrThrow({
    where: { id: runId },
    include: { ...runInclude, investment: true },
  });
  const now = Date.now();
  let changed = false;
  for (const leg of run.legs) {
    if (leg.status !== "executing" || now - leg.updatedAt.getTime() < RECONCILE_AFTER_MS) continue;
    const stale = now - leg.updatedAt.getTime() > GIVE_UP_AFTER_MS;
    if (!leg.signature) {
      if (!stale) continue;
      await db.rebalanceLeg.update({
        where: { id: leg.id },
        data: {
          status: "failed",
          outcomeUnknown: true,
          error:
            "We couldn't confirm whether this swap went through. Check your wallet; resuming re-plans from your current balances.",
        },
      });
      changed = true;
      continue;
    }
    const outcome = await getTransactionOutcome(leg.signature);
    if (outcome.status === "succeeded") {
      const deltas = walletDeltas(outcome.transaction, run.investment.owner);
      const inputAmount = (-(deltas[leg.inputMint] ?? 0n)).toString();
      const outputAmount = (deltas[leg.outputMint] ?? 0n).toString();
      const decimals = (leg.quote as { decimals?: number } | null)?.decimals;
      await db.rebalanceLeg.update({
        where: { id: leg.id },
        data: {
          status: "succeeded",
          inputAmount,
          outputAmount,
          realizedPrice:
            decimals === undefined
              ? null
              : realizedPrice(leg.side as "sell" | "buy", { inputAmount, outputAmount }, decimals),
          executedAt: new Date(
            outcome.transaction.blockTime ? outcome.transaction.blockTime * 1000 : now,
          ),
          error: null,
        },
      });
      changed = true;
    } else if (outcome.status === "failed" || stale) {
      await db.rebalanceLeg.update({
        where: { id: leg.id },
        data: {
          status: "failed",
          error:
            outcome.status === "failed"
              ? `The swap failed on-chain: ${outcome.error}`
              : "The swap didn't land in time. Nothing was traded; it's safe to retry.",
        },
      });
      changed = true;
    }
  }
  if (changed) await settleRun(runId);
}

export type PreparedLeg =
  | { status: "skipped"; reason: string; run: RunWithLegs }
  | { status: "failed"; reason: string; run: RunWithLegs }
  | {
      status: "quoted";
      run: RunWithLegs;
      order: {
        transaction: string;
        requestId: string;
        expireAt?: string | null;
        lastValidBlockHeight?: string | null;
      };
    };

const errorMessage = (error: unknown) => {
  if (error instanceof JupiterApiError) {
    try {
      return (JSON.parse(error.body) as { error?: string }).error ?? error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * Sizes leg `index` from freshly read balances and fetches a Jupiter order for
 * the owner to sign. Legs run strictly in order, so buys only start after
 * every sell is in and are sized from the USDC those sells produced.
 */
export async function prepareLeg(
  runId: string,
  index: number,
  owner: string,
): Promise<PreparedLeg> {
  await getOwnedRun(runId, owner); // ownership first: 404 before touching anything
  await reconcileRun(runId);
  const run = await getOwnedRun(runId, owner);
  if (run.status === "completed" || run.status === "cancelled") {
    throw new InvestError(409, `This rebalance is ${run.status}`);
  }
  const blocked = canQuoteLeg(run.legs, index);
  if (blocked) throw new InvestError(409, blocked);
  if (run.legs.some((leg) => leg.outcomeUnknown)) {
    throw new InvestError(409, "A swap's outcome is unknown; start a fresh rebalance instead");
  }
  const leg = run.legs.find((l) => l.index === index)!;
  const plan = (run.plan as unknown as Snapshot).plan;

  const balances = await getWalletBalances(owner);
  const remainingBuyUsd = run.legs
    .filter(
      (l) =>
        l.side === "buy" && l.index >= index && l.status !== "succeeded" && l.status !== "skipped",
    )
    .reduce((sum, l) => sum + l.plannedUsd, 0);
  const sizing = sizeLeg(
    {
      side: leg.side as "sell" | "buy",
      mint: leg.mint,
      usd: leg.plannedUsd,
      amount: leg.plannedAmount,
      full: leg.full,
    },
    { balances, remainingBuyUsd, usdcTargetUsd: plan.usdcTargetUsd },
  );
  if ("skip" in sizing) {
    await db.rebalanceLeg.update({
      where: { id: leg.id },
      data: { status: "skipped", error: sizing.skip },
    });
    return { status: "skipped", reason: sizing.skip, run: await settleRun(runId) };
  }

  const fail = async (reason: string): Promise<PreparedLeg> => {
    await db.rebalanceLeg.update({
      where: { id: leg.id },
      data: { status: "failed", error: reason },
    });
    return { status: "failed", reason, run: await settleRun(runId) };
  };
  let order;
  let decimals: number;
  try {
    [order, decimals] = await Promise.all([
      getOrder({
        inputMint: leg.inputMint,
        outputMint: leg.outputMint,
        amount: sizing.amount,
        taker: owner,
      }),
      getMintDecimals(leg.mint),
    ]);
  } catch (error) {
    return fail(`Couldn't get a quote: ${errorMessage(error)}`);
  }
  if (!order.transaction) {
    const reason = classifyOrderError(order);
    return fail(`${reason.title}: ${reason.message}`);
  }
  await db.rebalanceLeg.update({
    where: { id: leg.id },
    data: {
      status: "quoted",
      amount: sizing.amount,
      requestId: order.requestId,
      orderTransaction: order.transaction,
      error: null,
      quote: {
        inAmount: order.inAmount,
        outAmount: order.outAmount,
        otherAmountThreshold: order.otherAmountThreshold ?? null,
        priceImpact: order.priceImpact ?? null,
        feeBps: order.feeBps ?? null,
        router: order.router,
        decimals,
      },
    },
  });
  await db.rebalanceRun.update({ where: { id: runId }, data: { status: "executing" } });
  return {
    status: "quoted",
    run: await getOwnedRun(runId, owner),
    order: {
      transaction: order.transaction,
      requestId: order.requestId,
      expireAt: order.expireAt ?? null,
      lastValidBlockHeight: order.lastValidBlockHeight ?? null,
    },
  };
}

export type ExecutedLeg = {
  /** "requote": the quote expired before landing; nothing traded, prepare again. */
  outcome: "succeeded" | "failed" | "requote" | "unknown";
  message?: string;
  run: RunWithLegs;
};

/**
 * Checks the wallet-signed transaction is exactly the quoted order, records
 * it as executing, then sends it through Jupiter's /execute and records the
 * result. If our call to Jupiter dies, the leg stays "executing" and is
 * reconciled on-chain later.
 */
export async function executeLeg(
  runId: string,
  index: number,
  owner: string,
  signedTransaction: string,
): Promise<ExecutedLeg> {
  const run = await getOwnedRun(runId, owner);
  const leg = run.legs.find((l) => l.index === index);
  if (!leg || leg.status !== "quoted" || !leg.orderTransaction || !leg.requestId) {
    throw new InvestError(409, "This leg has no open quote; get a fresh one");
  }
  const check = checkSignedOrder(leg.orderTransaction, signedTransaction, owner);
  if (!check.ok) throw new InvestError(400, check.reason);

  await db.rebalanceLeg.update({
    where: { id: leg.id },
    data: { status: "executing", signature: check.signature },
  });

  let result;
  try {
    result = await executeOrder({ signedTransaction, requestId: leg.requestId });
  } catch (error) {
    if (error instanceof JupiterApiError && error.status === 400) {
      let body: { code?: number; error?: string } = {};
      try {
        body = JSON.parse(error.body);
      } catch {
        // keep defaults
      }
      result = {
        status: "Failed" as const,
        code: body.code ?? -1,
        error: body.error ?? error.message,
      };
    } else {
      console.error("[invest] execute call failed; will reconcile", error);
      return {
        outcome: "unknown",
        message: "We lost contact while the swap was sent. Checking on-chain shortly.",
        run: await getOwnedRun(runId, owner),
      };
    }
  }

  if (result.status === "Success") {
    const inputAmount = result.totalInputAmount ?? leg.amount ?? "0";
    const outputAmount = result.totalOutputAmount ?? "0";
    const decimals = (leg.quote as { decimals: number }).decimals;
    await db.rebalanceLeg.update({
      where: { id: leg.id },
      data: {
        status: "succeeded",
        signature: result.signature ?? check.signature,
        inputAmount,
        outputAmount,
        realizedPrice: realizedPrice(
          leg.side as "sell" | "buy",
          { inputAmount, outputAmount },
          decimals,
        ),
        executedAt: new Date(),
        error: null,
      },
    });
    return { outcome: "succeeded", run: await settleRun(runId) };
  }

  const classified = classifyExecuteResult({
    code: result.code,
    error: result.error ?? undefined,
    signature: result.signature ?? undefined,
  });
  if (classified.kind === "expired") {
    await db.rebalanceLeg.update({
      where: { id: leg.id },
      data: {
        status: "pending",
        requestId: null,
        orderTransaction: null,
        error: classified.message,
      },
    });
    return { outcome: "requote", message: classified.message, run: await settleRun(runId) };
  }
  await db.rebalanceLeg.update({
    where: { id: leg.id },
    data: {
      status: "failed",
      signature: result.signature ?? check.signature,
      error: `${classified.title}: ${classified.message}`,
    },
  });
  return { outcome: "failed", message: classified.message, run: await settleRun(runId) };
}

/** The user declined in their wallet, or gave up: the leg fails and the run can be resumed. */
export async function abandonLeg(runId: string, index: number, owner: string, reason: string) {
  const run = await getOwnedRun(runId, owner);
  const leg = run.legs.find((l) => l.index === index);
  if (!leg || leg.status !== "quoted")
    throw new InvestError(409, "This leg isn't waiting for a signature");
  await db.rebalanceLeg.update({
    where: { id: leg.id },
    data: { status: "failed", error: reason },
  });
  return settleRun(runId);
}

export async function cancelRun(runId: string, owner: string) {
  const run = await getOwnedRun(runId, owner);
  if (run.legs.some((leg) => leg.status === "executing")) {
    throw new InvestError(409, "A swap is still executing; wait for it to settle");
  }
  if (run.status === "completed") throw new InvestError(409, "This rebalance already completed");
  const cancelled = await db.rebalanceRun.update({
    where: { id: runId },
    data: { status: "cancelled", completedAt: new Date() },
    include: runInclude,
  });
  if (run.legs.some((leg) => leg.status === "succeeded"))
    await recordHoldings(run.investment, false);
  return cancelled;
}
