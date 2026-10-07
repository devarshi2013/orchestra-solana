import type { NextRequest } from "next/server";
import { connection } from "next/server";

import { createExecutionSchema } from "@/lib/assistant/schemas";
import { createExecution, listExecutions } from "@/server/assistant/executions";
import { handle, readJson, requireWallet } from "@/server/invest/route";

/** GET → the wallet's bought (or partly bought) assistant plans, newest first. */
export async function GET() {
  // Per-request data: never prerendered at build time.
  await connection();
  return handle(async () => Response.json(await listExecutions(await requireWallet())));
}

/** POST { conversationId?, rankingMethod, items } → records an approved plan, ready to buy item by item. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const owner = await requireWallet();
    const body = await readJson(request, createExecutionSchema);
    return Response.json(await createExecution(owner, body), { status: 201 });
  });
}
