import { connection } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { researchTop } from "@/server/markets/screener";

/** GET → the three largest technology stocks with market cap, 1Y return, P/E and liquidity (cached 15 min). */
export async function GET() {
  await connection();
  try {
    return Response.json(await researchTop(), {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("[markets] research top failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
