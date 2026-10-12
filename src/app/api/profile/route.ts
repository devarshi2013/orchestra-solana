import { webhookSchema } from "@/lib/strategies/types";
import { requireWallet } from "@/server/auth/session";
import { db, T } from "@/server/db";
import { jsonOr502, validationErrorResponse } from "@/server/http";
import { profile } from "@/server/strategies/profile";

/** GET → the signed-in wallet's positions, strategies, fills and notifications. */
export async function GET(request: Request) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  return jsonOr502("[profile] load failed", () => profile(wallet));
}

/** PATCH { webhookUrl } → sets (or clears, with null) where triggered strategies are POSTed. */
export async function PATCH(request: Request) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  const parsed = webhookSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  return jsonOr502("[profile] webhook failed", async () => {
    const sql = await db();
    await sql`
      insert into ${sql(T.users)} (wallet, webhook_url) values (${wallet}, ${parsed.data.webhookUrl})
      on conflict (wallet) do update set webhook_url = excluded.webhook_url`;
    return { ok: true };
  });
}
