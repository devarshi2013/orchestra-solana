import { connection } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import { errorResponse } from "@/server/http";
import { listMarkets } from "@/server/markets/screener";

/** GET → every company in the registry with its token's logo, price, 24h change, market cap and volume (cached 60 s). */
export async function GET() {
  // Live data: answered on request, never at build time.
  await connection();
  try {
    return Response.json(
      { rows: await listMarkets() },
      { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("[markets] list failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
