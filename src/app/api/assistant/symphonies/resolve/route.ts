import type { NextRequest } from "next/server";

import { proposalRequestSchema } from "@/lib/assistant/schemas";
import { resolveProposal } from "@/server/assistant/symphonies";
import { handle, readJson, requireWallet } from "@/server/invest/route";

/** POST { tree } → the proposal with registry mints, to apply an accepted suggestion. Saves nothing. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireWallet();
    const { tree } = await readJson(request, proposalRequestSchema);
    return Response.json({ symphony: await resolveProposal(tree) });
  });
}
