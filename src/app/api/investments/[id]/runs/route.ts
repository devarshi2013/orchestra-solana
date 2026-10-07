import type { NextRequest } from "next/server";

import { db } from "@/server/db";
import { handle, publicRun, requireWallet } from "@/server/invest/route";
import { createRun, getOwnedInvestment } from "@/server/invest/service";

/** An untouched plan older than this is stale (prices and targets moved); it's cancelled. */
const STALE_PLAN_MS = 10 * 60_000;

/** GET → the open rebalance, if any (planned, executing or partial). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/investments/[id]/runs">) {
  return handle(async () => {
    const owner = await requireWallet();
    const investment = await getOwnedInvestment((await ctx.params).id, owner);
    const open = await db.rebalanceRun.findFirst({
      where: { investmentId: investment.id, status: { in: ["planned", "executing", "partial"] } },
      include: { legs: { orderBy: { index: "asc" } } },
    });
    if (open?.status === "planned" && Date.now() - open.createdAt.getTime() > STALE_PLAN_MS) {
      await db.rebalanceRun.update({
        where: { id: open.id },
        data: { status: "cancelled", completedAt: new Date() },
      });
      return Response.json({ open: null });
    }
    return Response.json({ open: open ? publicRun(open) : null });
  });
}

/** POST → plans a rebalance from live balances; `run` is null when nothing needs trading. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/investments/[id]/runs">) {
  return handle(async () => {
    const owner = await requireWallet();
    const investment = await getOwnedInvestment((await ctx.params).id, owner);
    const { run, snapshot } = await createRun(investment);
    return Response.json({ run: run && publicRun(run), snapshot }, { status: run ? 201 : 200 });
  });
}
