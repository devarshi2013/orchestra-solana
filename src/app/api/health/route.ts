import { connection } from "next/server";

import { envProblems, serverEnv } from "@/env";

/**
 * GET → deployment health: which environment variables are missing or
 * invalid (names only; values are never shown) and which features are on.
 */
export async function GET() {
  await connection();
  const { missing, invalid } = envProblems();
  const ok = missing.length === 0 && invalid.length === 0;
  const feature = (on: unknown, off: string) => (on ? "configured" : off);
  return Response.json(
    {
      ok,
      missingEnv: missing,
      invalidEnv: invalid,
      jupiter: feature(!missing.includes("JUPITER_API_KEY"), "needs JUPITER_API_KEY"),
      assistant: feature(serverEnv.ANTHROPIC_API_KEY, "off (no ANTHROPIC_API_KEY)"),
      stockFundamentals: feature(serverEnv.MARKET_DATA_API_KEY, "off (no MARKET_DATA_API_KEY)"),
      charts: feature(
        serverEnv.COINGECKO_API_KEY && serverEnv.COINGECKO_API_BASE_URL,
        "off (needs COINGECKO_API_KEY and COINGECKO_API_BASE_URL)",
      ),
      strategies: feature(
        serverEnv.DATABASE_URL && serverEnv.SESSION_SECRET,
        "off (needs DATABASE_URL and SESSION_SECRET)",
      ),
      strategyWatcher: feature(serverEnv.CRON_SECRET, "off (no CRON_SECRET)"),
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
