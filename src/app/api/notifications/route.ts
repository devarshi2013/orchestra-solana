import { z } from "zod";

import { db } from "@/server/db";
import { handle, readJson, requireWallet } from "@/server/invest/route";

/**
 * GET → what the in-app banner shows: unread "rebalance due" notices, and
 * rebalances left partial (so they can be resumed).
 */
export async function GET() {
  return handle(async () => {
    const owner = await requireWallet();
    const [notifications, partial] = await Promise.all([
      db.notification.findMany({
        where: { owner, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.rebalanceRun.findMany({
        where: { status: "partial", investment: { owner } },
        select: { id: true, investmentId: true, investment: { select: { name: true } } },
        take: 5,
      }),
    ]);
    return Response.json({ notifications, partial });
  });
}

/** PATCH { id } → dismisses a notice. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const owner = await requireWallet();
    const { id } = await readJson(request, z.object({ id: z.uuid() }));
    await db.notification.updateMany({ where: { id, owner }, data: { readAt: new Date() } });
    return Response.json({ ok: true });
  });
}
