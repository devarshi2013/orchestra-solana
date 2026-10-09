import { connection } from "next/server";

import { getBrowseMetrics } from "@/server/stocks/metrics";

/**
 * GET → per-ticker market cap, 24h change and 1Y return for sorting the
 * "Browse stocks" panel, plus which of them are available. Live data: never
 * prerendered; cached briefly here and at the CDN.
 */
export async function GET() {
  await connection();
  const result = await getBrowseMetrics();
  return Response.json(result, {
    headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=300" },
  });
}
