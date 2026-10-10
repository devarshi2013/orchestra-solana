import type { NextRequest } from "next/server";

import { quoteRequestSchema } from "@/lib/assistant/schemas";
import { friendlyError } from "@/lib/friendly-error";
import { quoteItem } from "@/server/agent/quote";
import { errorResponse, validationErrorResponse } from "@/server/http";

/** POST { wallet, symbol, usdcAmount } → a fresh Jupiter quote for one plan item. Never trades. */
export async function POST(request: NextRequest) {
  const parsed = quoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { wallet, ...item } = parsed.data;
  try {
    return Response.json(await quoteItem(wallet, item));
  } catch (error) {
    console.error("[quote] failed", error);
    return errorResponse(503, friendlyError(error));
  }
}
