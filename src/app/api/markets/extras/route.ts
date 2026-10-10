import { connection } from "next/server";

import { investorExtras } from "@/server/markets/screener";

/**
 * GET → token-vs-stock price gaps and the AUD/USD rate for the home page's
 * investor tiles. Each part is null when there's no fundamentals source, and
 * the tiles hide. FMP data is cached 15 min; token prices 10 s.
 */
export async function GET() {
  await connection();
  return Response.json(await investorExtras(), { headers: { "cache-control": "no-store" } });
}
