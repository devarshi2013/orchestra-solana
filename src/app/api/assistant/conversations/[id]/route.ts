import type { NextRequest } from "next/server";

import { getTranscript } from "@/server/assistant/conversations";
import { handle, requireWallet } from "@/server/invest/route";
import { InvestError } from "@/server/invest/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET → one of the wallet's chats, replayed for display (text, data used, plans). */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/assistant/conversations/[id]">,
) {
  return handle(async () => {
    const owner = await requireWallet();
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new InvestError(404, "Conversation not found");
    return Response.json(await getTranscript(id, owner));
  });
}
