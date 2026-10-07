import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { validatePlan } from "@/lib/agent/plan";
import type { CreateExecution } from "@/lib/assistant/schemas";
import type {
  ExecutedItem,
  ExecutionStatus,
  ExecutionView,
  PreparedItem,
} from "@/lib/assistant/views";
import { toBaseUnits, toUnits, USDC_DECIMALS } from "@/lib/invest/plan";
import { classifyExecuteResult, classifyOrderError } from "@/lib/swap/errors";
import { USDC_MINT } from "@/lib/tokens";
import { getRegistry } from "@/server/assets/registry";
import { db } from "@/server/db";
import { InvestError } from "@/server/invest/service";
import { JupiterApiError } from "@/server/jupiter/client";
import { executeOrder, getOrder } from "@/server/jupiter/swap";
import { checkSignedOrder } from "@/server/solana/signed-order";
import { getTransactionOutcome, getWalletBalances, walletDeltas } from "@/server/solana/rpc";

import { requireDisclosure } from "./disclosure";

/**
 * Buying an assistant plan, item by item, from the owner's wallet: the server
 * resolves each symbol to its mint in the asset registry (never from the
 * model or the browser), fetches the Jupiter order, checks the wallet signed
 * exactly that order, sends it through /execute and records the outcome.
 */

/** Items stuck "executing" this long are looked up on-chain. */
const RECONCILE_AFTER_MS = 60_000;
/** After this, an unconfirmed item is given up on. */
const GIVE_UP_AFTER_MS = 180_000;

const include = { items: { orderBy: { index: "asc" } } } as const;
type ExecutionRow = Prisma.PlanExecutionGetPayload<{ include: typeof include }>;

/** The browser's view: no unsigned transactions, no mints. */
export function publicExecution(row: ExecutionRow): ExecutionView {
  return {
    id: row.id,
    conversationId: row.conversationId,
    rankingMethod: row.rankingMethod,
    totalUsdc: row.totalUsdc,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    items: row.items.map((item) => ({
      id: item.id,
      index: item.index,
      kind: item.kind as "stock" | "crypto",
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals,
      usdcAmount: item.usdcAmount,
      status: item.status,
      signature: item.signature,
      inputAmount: item.inputAmount,
      outputAmount: item.outputAmount,
      error: item.error,
      outcomeUnknown: item.outcomeUnknown,
      executedAt: item.executedAt?.toISOString() ?? null,
    })),
  };
}

async function getOwned(id: string, owner: string): Promise<ExecutionRow> {
  const row = await db.planExecution.findUnique({ where: { id }, include });
  if (!row || row.owner !== owner) throw new InvestError(404, "Plan not found");
  return row;
}

async function usdcBalance(owner: string): Promise<number> {
  const balances = await getWalletBalances(owner);
  return toUnits(balances[USDC_MINT]?.amount ?? "0", USDC_DECIMALS);
}

/**
 * Records the plan the user approved (amounts as edited). It's checked like
 * the assistant's plan: registry symbols of the right kind, minimum order
 * size, no duplicates, and a total within the wallet's live USDC.
 */
export async function createExecution(owner: string, input: CreateExecution) {
  await requireDisclosure(owner);
  if (input.conversationId) {
    const conversation = await db.agentConversation.findUnique({
      where: { id: input.conversationId },
      select: { owner: true },
    });
    if (conversation?.owner !== owner) throw new InvestError(404, "Conversation not found");
  }
  const [registry, usdc] = await Promise.all([getRegistry(), usdcBalance(owner)]);
  const assets = [...registry.stocks, ...registry.crypto];
  const totalUsdc = Math.round(input.items.reduce((sum, i) => sum + i.usdcAmount, 0) * 100) / 100;
  const checked = validatePlan(
    {
      items: input.items.map((i) => ({
        kind: i.kind,
        ticker: i.symbol,
        usdcAmount: i.usdcAmount,
        reason: i.reason,
      })),
      totalUsdc,
      rankingMethod: input.rankingMethod,
    },
    { assets, usdcBalance: usdc },
  );
  if (!checked.ok) throw new InvestError(400, checked.errors.join(" "));

  const items = checked.plan.items.map((item, index) => {
    const asset = assets.find((a) => a.kind === item.kind && a.symbol === item.symbol)!;
    return {
      index,
      kind: item.kind,
      symbol: asset.symbol,
      name: asset.name,
      mint: asset.mint,
      decimals: asset.decimals,
      usdcAmount: item.usdcAmount,
    };
  });
  const row = await db.planExecution.create({
    data: {
      owner,
      conversationId: input.conversationId ?? null,
      rankingMethod: input.rankingMethod,
      totalUsdc,
      items: { create: items },
    },
    include,
  });
  return publicExecution(row);
}

/** Derives the execution's status from its items. */
function deriveStatus(items: { status: string }[]): ExecutionStatus {
  if (items.every((i) => i.status === "succeeded")) return "completed";
  if (items.some((i) => ["pending", "quoted", "executing"].includes(i.status))) {
    return items.some((i) => i.status !== "pending") ? "executing" : "planned";
  }
  return "partial";
}

async function settle(id: string): Promise<ExecutionRow> {
  const row = await db.planExecution.findUniqueOrThrow({ where: { id }, include });
  if (row.status === "cancelled") return row;
  const status = deriveStatus(row.items);
  if (status === row.status) return row;
  return db.planExecution.update({
    where: { id },
    data: {
      status,
      completedAt: status === "completed" || status === "partial" ? new Date() : null,
    },
    include,
  });
}

/** Looks up items stuck "executing" (the browser or our call to Jupiter died) on-chain. */
export async function reconcileExecution(id: string): Promise<void> {
  const row = await db.planExecution.findUniqueOrThrow({ where: { id }, include });
  const now = Date.now();
  let changed = false;
  for (const item of row.items) {
    if (item.status !== "executing" || now - item.updatedAt.getTime() < RECONCILE_AFTER_MS)
      continue;
    const stale = now - item.updatedAt.getTime() > GIVE_UP_AFTER_MS;
    if (!item.signature) {
      if (!stale) continue;
      await db.planExecutionItem.update({
        where: { id: item.id },
        data: {
          status: "failed",
          outcomeUnknown: true,
          error:
            "We couldn't confirm whether this buy went through. Check your wallet before buying it again.",
        },
      });
      changed = true;
      continue;
    }
    const outcome = await getTransactionOutcome(item.signature);
    if (outcome.status === "succeeded") {
      const deltas = walletDeltas(outcome.transaction, row.owner);
      await db.planExecutionItem.update({
        where: { id: item.id },
        data: {
          status: "succeeded",
          inputAmount: (-(deltas[USDC_MINT] ?? 0n)).toString(),
          outputAmount: (deltas[item.mint] ?? 0n).toString(),
          executedAt: new Date(
            outcome.transaction.blockTime ? outcome.transaction.blockTime * 1000 : now,
          ),
          error: null,
        },
      });
      changed = true;
    } else if (outcome.status === "failed" || stale) {
      await db.planExecutionItem.update({
        where: { id: item.id },
        data: {
          status: "failed",
          error:
            outcome.status === "failed"
              ? `The swap failed on-chain: ${outcome.error}`
              : "The swap didn't land in time. Nothing was bought; it's safe to retry.",
        },
      });
      changed = true;
    }
  }
  if (changed) await settle(id);
}

export async function getExecution(id: string, owner: string): Promise<ExecutionView> {
  await getOwned(id, owner);
  await reconcileExecution(id);
  return publicExecution(await getOwned(id, owner));
}

export async function listExecutions(owner: string, take = 50): Promise<ExecutionView[]> {
  const rows = await db.planExecution.findMany({
    where: { owner },
    orderBy: { createdAt: "desc" },
    take,
    include,
  });
  return rows.map(publicExecution);
}

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
 * A fresh Jupiter order for item `index`, for the owner to sign. Pending items
 * and failed ones (a retry) can be prepared; items whose outcome is unknown
 * can't, since buying again could buy twice.
 */
export async function prepareItem(id: string, index: number, owner: string): Promise<PreparedItem> {
  await getOwned(id, owner);
  await reconcileExecution(id);
  const row = await getOwned(id, owner);
  if (row.status === "cancelled") throw new InvestError(409, "This plan was cancelled");
  const item = row.items.find((i) => i.index === index);
  if (!item) throw new InvestError(404, "No such item");
  if (item.outcomeUnknown)
    throw new InvestError(409, "This buy's outcome is unknown; check your wallet first");
  if (!["pending", "failed", "quoted"].includes(item.status))
    throw new InvestError(409, `This item is ${item.status}`);
  if (row.items.some((i) => i.status === "executing"))
    throw new InvestError(409, "Another buy is still being sent; wait for it to settle");

  const fail = async (reason: string): Promise<PreparedItem> => {
    await db.planExecutionItem.update({
      where: { id: item.id },
      data: { status: "failed", requestId: null, orderTransaction: null, error: reason },
    });
    return { status: "failed", reason, execution: publicExecution(await settle(id)) };
  };

  const usdc = await usdcBalance(owner).catch(() => null);
  if (usdc !== null && usdc + 1e-9 < item.usdcAmount) {
    return fail(`Not enough USDC: this buy needs ${item.usdcAmount}, your wallet holds ${usdc}`);
  }
  let order;
  try {
    order = await getOrder({
      inputMint: USDC_MINT,
      outputMint: item.mint,
      amount: toBaseUnits(item.usdcAmount, USDC_DECIMALS).toString(),
      taker: owner,
    });
  } catch (error) {
    return fail(`Couldn't get a quote: ${errorMessage(error)}`);
  }
  if (!order.transaction) {
    const reason = classifyOrderError(order);
    return fail(`${reason.title}: ${reason.message}`);
  }
  await db.planExecutionItem.update({
    where: { id: item.id },
    data: {
      status: "quoted",
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
      },
    },
  });
  if (row.status === "planned" || row.status === "partial") {
    await db.planExecution.update({
      where: { id },
      data: { status: "executing", completedAt: null },
    });
  }
  return {
    status: "quoted",
    execution: publicExecution(await getOwned(id, owner)),
    order: {
      transaction: order.transaction,
      requestId: order.requestId,
      expireAt: order.expireAt ?? null,
      lastValidBlockHeight: order.lastValidBlockHeight ?? null,
    },
  };
}

/**
 * Checks the wallet-signed transaction is exactly the quoted order, then sends
 * it through Jupiter's /execute and records the result. If our call to
 * Jupiter dies, the item stays "executing" and is reconciled on-chain later.
 */
export async function executeItem(
  id: string,
  index: number,
  owner: string,
  signedTransaction: string,
): Promise<ExecutedItem> {
  const row = await getOwned(id, owner);
  const item = row.items.find((i) => i.index === index);
  if (!item || item.status !== "quoted" || !item.orderTransaction || !item.requestId) {
    throw new InvestError(409, "This item has no open quote; get a fresh one");
  }
  const check = checkSignedOrder(item.orderTransaction, signedTransaction, owner);
  if (!check.ok) throw new InvestError(400, check.reason);

  await db.planExecutionItem.update({
    where: { id: item.id },
    data: { status: "executing", signature: check.signature },
  });

  let result;
  try {
    result = await executeOrder({ signedTransaction, requestId: item.requestId });
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
      console.error("[assistant] execute call failed; will reconcile", error);
      return {
        outcome: "unknown",
        message: "We lost contact while the swap was sent. Checking on-chain shortly.",
        execution: publicExecution(await getOwned(id, owner)),
      };
    }
  }

  if (result.status === "Success") {
    await db.planExecutionItem.update({
      where: { id: item.id },
      data: {
        status: "succeeded",
        signature: result.signature ?? check.signature,
        inputAmount: result.totalInputAmount ?? null,
        outputAmount: result.totalOutputAmount ?? null,
        executedAt: new Date(),
        orderTransaction: null,
        error: null,
      },
    });
    return { outcome: "succeeded", execution: publicExecution(await settle(id)) };
  }

  const classified = classifyExecuteResult({
    code: result.code,
    error: result.error ?? undefined,
    signature: result.signature ?? undefined,
  });
  if (classified.kind === "expired") {
    await db.planExecutionItem.update({
      where: { id: item.id },
      data: {
        status: "pending",
        requestId: null,
        orderTransaction: null,
        signature: null,
        error: classified.message,
      },
    });
    return {
      outcome: "requote",
      message: classified.message,
      execution: publicExecution(await settle(id)),
    };
  }
  await db.planExecutionItem.update({
    where: { id: item.id },
    data: {
      status: "failed",
      signature: result.signature ?? check.signature,
      orderTransaction: null,
      error: `${classified.title}: ${classified.message}`,
    },
  });
  return {
    outcome: "failed",
    message: classified.message,
    execution: publicExecution(await settle(id)),
  };
}

/**
 * The user declined in their wallet, or the quote kept expiring: the item
 * fails (nothing was sent) and can be retried.
 */
export async function abandonItem(id: string, index: number, owner: string, reason: string) {
  const row = await getOwned(id, owner);
  const item = row.items.find((i) => i.index === index);
  if (!item || (item.status !== "quoted" && item.status !== "pending"))
    throw new InvestError(409, "This item isn't waiting for a signature");
  await db.planExecutionItem.update({
    where: { id: item.id },
    data: { status: "failed", requestId: null, orderTransaction: null, error: reason },
  });
  return publicExecution(await settle(id));
}
