import { connection } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { marketOverview } from "@/server/markets/screener";

/** GET → the home page's live data: stock and crypto rows, registry totals and when it was read (cached 60 s). */
export async function GET() {
  await connection();
  try {
    return Response.json(await marketOverview(), {
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[markets] overview failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
