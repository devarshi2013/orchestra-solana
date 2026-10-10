import { connection } from "next/server";

import { envProblems, serverEnv } from "@/env/server";

/**
 * GET → deployment health: which environment variables are missing or
 * invalid (names only; values are never shown) and which features are on.
 */
export async function GET() {
  await connection();
  const env = envProblems();
  const ok = env.missing.length === 0 && env.invalid.length === 0;
  return Response.json(
    {
      ok,
      missingEnv: env.missing,
      invalidEnv: env.invalid,
      jupiter: env.missing.includes("JUPITER_API_KEY") ? "needs JUPITER_API_KEY" : "configured",
      assistant: serverEnv.ANTHROPIC_API_KEY ? "configured" : "off (no ANTHROPIC_API_KEY)",
      stockFundamentals: serverEnv.MARKET_DATA_API_KEY
        ? "configured"
        : "off (no MARKET_DATA_API_KEY)",
      emailSignup:
        serverEnv.RESEND_API_KEY && serverEnv.RESEND_AUDIENCE_ID
          ? "configured"
          : "off (needs RESEND_API_KEY and RESEND_AUDIENCE_ID)",
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
