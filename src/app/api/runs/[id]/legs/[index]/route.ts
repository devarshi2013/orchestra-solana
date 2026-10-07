import type { NextRequest } from "next/server";

import { legActionSchema } from "@/lib/invest/schemas";
import { handle, publicRun, readJson, requireWallet } from "@/server/invest/route";
import { abandonLeg, executeLeg, InvestError, prepareLeg } from "@/server/invest/service";

/**
 * POST one step of a leg:
 * - { action: "prepare" } → size from live balances, fresh Jupiter order to sign;
 * - { action: "execute", signedTransaction } → check, send via /execute, record;
 * - { action: "abandon", reason } → the user declined; the run can be resumed.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/runs/[id]/legs/[index]">) {
  return handle(async () => {
    const owner = await requireWallet();
    const { id, index: rawIndex } = await ctx.params;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0) throw new InvestError(400, "Bad leg index");
    const body = await readJson(request, legActionSchema);
    switch (body.action) {
      case "prepare": {
        const prepared = await prepareLeg(id, index, owner);
        return Response.json({ ...prepared, run: publicRun(prepared.run) });
      }
      case "execute": {
        const executed = await executeLeg(id, index, owner, body.signedTransaction);
        return Response.json({ ...executed, run: publicRun(executed.run) });
      }
      case "abandon":
        return Response.json({ run: publicRun(await abandonLeg(id, index, owner, body.reason)) });
    }
  });
}
