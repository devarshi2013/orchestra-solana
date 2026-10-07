import type { NextRequest } from "next/server";

import { keepBalancedSchema } from "@/lib/assistant/schemas";
import { keepBalanced } from "@/server/assistant/symphonies";
import { handle, readJson, requireWallet } from "@/server/invest/route";
import { InvestError } from "@/server/invest/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { name, rebalance, driftThresholdPct } → a live symphony holding what
 * this plan bought, at its weights. Nothing trades until the user signs a
 * rebalance.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/assistant/executions/[id]/keep-balanced">,
) {
  return handle(async () => {
    const owner = await requireWallet();
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new InvestError(404, "Plan not found");
    const body = await readJson(request, keepBalancedSchema);
    return Response.json(await keepBalanced(owner, id, body), { status: 201 });
  });
}
