import type { NextRequest } from "next/server";
import { z } from "zod";

import { handle, publicRun, readJson, requireWallet } from "@/server/invest/route";
import { cancelRun, getOwnedRun, reconcileRun } from "@/server/invest/service";

/** GET → the run and its legs, after reconciling any leg stuck mid-flight on-chain. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/runs/[id]">) {
  return handle(async () => {
    const owner = await requireWallet();
    const { id } = await ctx.params;
    await getOwnedRun(id, owner);
    await reconcileRun(id);
    return Response.json(publicRun(await getOwnedRun(id, owner)));
  });
}

/** PATCH { action: "cancel" } → stops the run; finished legs stay recorded. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/runs/[id]">) {
  return handle(async () => {
    const owner = await requireWallet();
    await readJson(request, z.object({ action: z.literal("cancel") }));
    return Response.json(publicRun(await cancelRun((await ctx.params).id, owner)));
  });
}
