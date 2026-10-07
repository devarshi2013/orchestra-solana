import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { registryLookup } from "@/lib/assets/symphony-tools";
import { keepBalancedSymphony } from "@/lib/assistant/keep-balanced";
import { trackMints } from "@/lib/market/store";
import { collectMints } from "@/lib/symphony/mints";
import { toMintTree, type TickerSymphony } from "@/lib/symphony/ticker-tree";
import type { Symphony } from "@/lib/symphony/types";
import type { RebalanceRule } from "@/lib/backtest/types";
import { db } from "@/server/db";
import { createInvestment, InvestError } from "@/server/invest/service";

/**
 * What happens when the user acts on an assistant proposal. Mints always come
 * from the registry (the proposal only names tickers), and nothing is saved
 * or invested except by these explicit user actions.
 */

/** A proposal → a symphony with registry mints, checked like createSymphony. */
export async function resolveProposal(tree: TickerSymphony): Promise<Symphony> {
  const { resolve } = await registryLookup();
  const converted = toMintTree(tree, resolve);
  if (!converted.ok) throw new InvestError(400, converted.errors.join("; "));
  return converted.symphony;
}

/** "Open in editor": saves the proposal as a new draft owned by the wallet. */
export async function draftFromProposal(owner: string, tree: TickerSymphony) {
  const symphony = await resolveProposal(tree);
  const draft = await db.symphonyDraft.create({
    data: {
      id: crypto.randomUUID(),
      owner,
      name: symphony.name,
      symphony: symphony as unknown as Prisma.InputJsonValue,
    },
  });
  await trackMints([...collectMints(symphony.root)]).catch(() => {});
  return { draftId: draft.id };
}

/**
 * "Keep this balanced automatically": a live symphony holding what an
 * assistant plan bought, at the plan's weights, rebalanced on the chosen
 * schedule. Uses the bought items' registry mints as stored at purchase.
 */
export async function keepBalanced(
  owner: string,
  executionId: string,
  body: { name: string; rebalance: RebalanceRule; driftThresholdPct: number },
) {
  const execution = await db.planExecution.findUnique({
    where: { id: executionId },
    include: { items: { orderBy: { index: "asc" } } },
  });
  if (!execution || execution.owner !== owner) throw new InvestError(404, "Plan not found");
  const symphony = keepBalancedSymphony(body.name, execution.items);
  if (!symphony) throw new InvestError(409, "Nothing from this plan was bought yet");
  const investment = await createInvestment(owner, {
    symphony,
    rebalance: body.rebalance,
    driftThresholdPct: body.driftThresholdPct,
  });
  return { investmentId: investment.id, symphony };
}
