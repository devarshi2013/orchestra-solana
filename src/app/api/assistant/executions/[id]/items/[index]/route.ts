import type { NextRequest } from "next/server";

import { itemActionSchema } from "@/lib/assistant/schemas";
import { abandonItem, executeItem, prepareItem } from "@/server/assistant/executions";
import { handle, readJson, requireWallet } from "@/server/invest/route";
import { InvestError } from "@/server/invest/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST one step of buying a plan item:
 * - { action: "prepare" } → fresh Jupiter order for the wallet to sign;
 * - { action: "execute", signedTransaction } → check it's that order, send via /execute, record;
 * - { action: "abandon", reason } → the user declined; the item can be retried.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/assistant/executions/[id]/items/[index]">,
) {
  return handle(async () => {
    const owner = await requireWallet();
    const { id, index: rawIndex } = await ctx.params;
    const index = Number(rawIndex);
    if (!UUID.test(id)) throw new InvestError(404, "Plan not found");
    if (!Number.isInteger(index) || index < 0) throw new InvestError(400, "Bad item index");
    const body = await readJson(request, itemActionSchema);
    switch (body.action) {
      case "prepare":
        return Response.json(await prepareItem(id, index, owner));
      case "execute":
        return Response.json(await executeItem(id, index, owner, body.signedTransaction));
      case "abandon":
        return Response.json(await abandonItem(id, index, owner, body.reason));
    }
  });
}
