import type { NextRequest } from "next/server";

import { verifySchema, type MeResponse } from "@/lib/strategies/types";
import { sessionCookie } from "@/server/auth/session";
import { verifySignIn } from "@/server/auth/sign-in";
import { db, strategiesConfigured, strategiesOff, T } from "@/server/db";
import { errorResponse, jsonOr502, validationErrorResponse } from "@/server/http";

/** POST { wallet, signature, message } → the session cookie when the wallet signed a live sign-in message. */
export async function POST(request: NextRequest) {
  if (!strategiesConfigured()) return strategiesOff();
  const parsed = verifySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  return jsonOr502("[auth] verify failed", async () => {
    const ok = await verifySignIn({ ...parsed.data, host: request.nextUrl.host });
    if (!ok) return errorResponse(401, "Sign-in failed. Try again.");
    // Signed-up wallets get daily portfolio snapshots (src/server/portfolio/history.ts).
    const sql = await db();
    await sql`insert into ${sql(T.users)} (wallet) values (${parsed.data.wallet}) on conflict (wallet) do nothing`;
    return Response.json({ wallet: parsed.data.wallet } satisfies MeResponse, {
      headers: { "set-cookie": sessionCookie(parsed.data.wallet), "cache-control": "no-store" },
    });
  });
}
