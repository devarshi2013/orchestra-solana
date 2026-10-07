import type { NextRequest } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { updateInvestmentSchema } from "@/lib/invest/schemas";
import { nextDueAt } from "@/lib/invest/schedule";
import { db } from "@/server/db";
import { handle, readJson, requireWallet } from "@/server/invest/route";
import { getOwnedInvestment, ruleOf } from "@/server/invest/service";

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

/** PATCH → pause/resume/close, or change schedule, drift threshold or email. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/investments/[id]">) {
  return handle(async () => {
    const owner = await requireWallet();
    const investment = await getOwnedInvestment((await ctx.params).id, owner);
    const body = await readJson(request, updateInvestmentSchema);
    const rule = body.rebalance ?? ruleOf(investment);
    const reschedule = body.rebalance !== undefined || body.status === "active";
    const updated = await db.investment.update({
      where: { id: investment.id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.rebalance && { rebalance: body.rebalance as unknown as Prisma.InputJsonValue }),
        ...(body.driftThresholdPct !== undefined && { driftThresholdPct: body.driftThresholdPct }),
        ...(body.notifyEmail !== undefined && { notifyEmail: body.notifyEmail }),
        ...(reschedule && { nextDueAt: nextDueAt(rule, new Date()) }),
      },
    });
    return Response.json(updated);
  });
}
