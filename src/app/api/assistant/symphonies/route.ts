import type { NextRequest } from "next/server";

import { proposalRequestSchema } from "@/lib/assistant/schemas";
import { draftFromProposal } from "@/server/assistant/symphonies";
import { handle, readJson, requireWallet } from "@/server/invest/route";

/** POST { tree } → saves an assistant proposal as a draft for this wallet ("Open in editor"). */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const owner = await requireWallet();
    const { tree } = await readJson(request, proposalRequestSchema);
    return Response.json(await draftFromProposal(owner, tree), { status: 201 });
  });
}
