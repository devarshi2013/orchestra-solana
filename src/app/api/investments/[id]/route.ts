import type { NextRequest } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { updateInvestmentSchema } from "@/lib/invest/schemas";
import { nextDueAt } from "@/lib/invest/schedule";
import { db } from "@/server/db";
import { handle, readJson, requireWallet } from "@/server/invest/route";
import { trackMints } from "@/lib/market/store";
import { validateSymphony } from "@/lib/symphony/validate";
import { listedAssets } from "@/server/assets/registry";
import { getOwnedInvestment, InvestError, ruleOf, universeOf } from "@/server/invest/service";

/** GET → one investment and its recent rebalances. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/investments/[id]">) {
  return handle(async () => {
    const owner = await requireWallet();
    const investment = await getOwnedInvestment((await ctx.params).id, owner);
    const runs = await db.rebalanceRun.findMany({
      where: { investmentId: investment.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { legs: { orderBy: { index: "asc" }, omit: { orderTransaction: true } } },
    });
    return Response.json({ ...investment, runs });
  });
}

/**
 * PATCH → pause/resume/close, or change schedule, drift threshold, email or
 * the symphony itself. A new symphony is checked against the registry and
 * can't change while a rebalance is open.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/investments/[id]">) {
  return handle(async () => {
    const owner = await requireWallet();
    const investment = await getOwnedInvestment((await ctx.params).id, owner);
    const body = await readJson(request, updateInvestmentSchema);
    if (body.symphony) {
      const { isListed } = await listedAssets();
      const issues = validateSymphony(body.symphony, { isKnownMint: isListed });
      if (issues.length > 0) {
        throw new InvestError(
          400,
          `Fix the symphony first: ${issues.map((i) => i.message).join("; ")}`,
        );
      }
      const open = await db.rebalanceRun.findFirst({
        where: { investmentId: investment.id, status: { in: ["planned", "executing", "partial"] } },
      });
      if (open) throw new InvestError(409, "Finish or cancel the open rebalance first");
      await trackMints(universeOf(body.symphony));
    }
    const rule = body.rebalance ?? ruleOf(investment);
    const reschedule = body.rebalance !== undefined || body.status === "active";
    const updated = await db.investment.update({
      where: { id: investment.id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.rebalance && { rebalance: body.rebalance as unknown as Prisma.InputJsonValue }),
        ...(body.driftThresholdPct !== undefined && { driftThresholdPct: body.driftThresholdPct }),
        ...(body.notifyEmail !== undefined && { notifyEmail: body.notifyEmail }),
        ...(body.symphony && {
          symphony: body.symphony as unknown as Prisma.InputJsonValue,
          name: body.symphony.name,
        }),
        ...(reschedule && { nextDueAt: nextDueAt(rule, new Date()) }),
      },
    });
    return Response.json(updated);
  });
}
