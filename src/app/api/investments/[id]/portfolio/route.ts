import type { NextRequest } from "next/server";

import { handle, requireWallet } from "@/server/invest/route";
import { getOwnedInvestment, maxDriftPct, snapshot } from "@/server/invest/service";

/** GET → live balances, prices, today's target and the plan it implies (nothing is traded). */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/investments/[id]/portfolio">,
) {
  return handle(async () => {
    const owner = await requireWallet();
    const investment = await getOwnedInvestment((await ctx.params).id, owner);
    const snap = await snapshot(investment);
    return Response.json({ ...snap, maxDriftPct: maxDriftPct(snap.plan) });
  });
}
