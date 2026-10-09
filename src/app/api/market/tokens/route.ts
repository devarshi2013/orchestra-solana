import { connection } from "next/server";

import { upstreamErrorResponse } from "@/server/http";
import { getTokenStats } from "@/server/market/jupiter-market";

/** GET → logo, market cap, 24h volume, liquidity and holders per dashboard token (Jupiter Tokens API). */
export async function GET() {
  // Live data: render per request, never at build time.
  await connection();
  try {
    const tokens = await getTokenStats();
    return Response.json(
      { tokens },
      { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
