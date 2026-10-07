import type { NextRequest } from "next/server";

import { quoteRequestSchema } from "@/lib/assistant/schemas";
import { quoteItem } from "@/server/assistant/quote";
import { handle, readJson, requireWallet } from "@/server/invest/route";

/** POST { symbol, usdcAmount } → a fresh Jupiter quote for one plan item, for the signed-in wallet. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const owner = await requireWallet();
    const body = await readJson(request, quoteRequestSchema);
    return Response.json(await quoteItem(owner, body));
  });
}
