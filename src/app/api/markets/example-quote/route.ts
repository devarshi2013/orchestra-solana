import { connection } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { exampleQuote } from "@/server/markets/screener";

/** GET → a real Jupiter quote for 10 USDC of NVDA (no taker: pricing only, nothing to sign). Cached 30 s. */
export async function GET() {
  await connection();
  try {
    return Response.json(await exampleQuote(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[markets] example quote failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
