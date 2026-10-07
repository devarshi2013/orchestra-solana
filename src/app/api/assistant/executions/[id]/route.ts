import type { NextRequest } from "next/server";

import { getExecution } from "@/server/assistant/executions";
import { handle, requireWallet } from "@/server/invest/route";
import { InvestError } from "@/server/invest/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET → one plan execution with each item's status (stuck items are checked on-chain first). */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/assistant/executions/[id]">,
) {
  return handle(async () => {
    const owner = await requireWallet();
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new InvestError(404, "Plan not found");
    return Response.json(await getExecution(id, owner));
  });
}
