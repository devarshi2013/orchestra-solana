import { connection } from "next/server";

import { upstreamErrorResponse } from "@/server/http";
import { getLivePrices } from "@/server/market/jupiter-market";

/**
 * GET → live USD price and 24h change for every dashboard token, in one
 * response (the browser polls this; it never polls per token). Cached for a
 * few seconds here and at the CDN, so Jupiter sees at most one call per
 * few seconds however many visitors there are.
 */
export async function GET() {
  // Live data: render per request, never at build time.
  await connection();
  try {
    const prices = await getLivePrices();
    return Response.json(
      { at: Date.now(), prices },
      { headers: { "cache-control": "public, s-maxage=4, stale-while-revalidate=4" } },
    );
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
