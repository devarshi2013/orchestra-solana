import { connection } from "next/server";

import { envProblems, serverEnv } from "@/env/server";
import { db } from "@/server/db";

/**
 * GET → deployment health: which required environment variables are missing
 * or invalid (names only; values are never shown), whether the database is
 * reachable, and whether its tables exist (migrations applied).
 */
export async function GET() {
  await connection();
  const env = envProblems();
  const session = process.env.NODE_ENV !== "production" || !env.missing.includes("SESSION_SECRET");
  let database: "ok" | "not configured" | "unreachable" | "no tables (migrations not applied)" =
    "not configured";
  if (!env.missing.includes("DATABASE_URL") && !env.invalid.includes("DATABASE_URL")) {
    try {
      const [row] = await db.$queryRaw<{ table: string | null }[]>`
        SELECT to_regclass('public.agent_conversations')::text AS "table"`;
      database = row?.table ? "ok" : "no tables (migrations not applied)";
    } catch {
      database = "unreachable";
    }
  }
  const ok = env.missing.length === 0 && env.invalid.length === 0 && database === "ok";
  return Response.json(
    {
      ok,
      missingEnv: env.missing,
      invalidEnv: env.invalid,
      walletSignIn: session ? "ok" : "needs SESSION_SECRET",
      database,
      jupiter: env.missing.includes("JUPITER_API_KEY") ? "needs JUPITER_API_KEY" : "configured",
      assistant: serverEnv.ANTHROPIC_API_KEY ? "configured" : "off (no ANTHROPIC_API_KEY)",
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
