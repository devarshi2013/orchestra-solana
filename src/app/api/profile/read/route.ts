import { z } from "zod";

import { requireWallet } from "@/server/auth/session";
import { db, T } from "@/server/db";
import { jsonOr502, validationErrorResponse } from "@/server/http";

const bodySchema = z.object({ ids: z.array(z.uuid()).max(200).optional() });

/** POST { ids? } → marks those notifications read (all of them without ids). */
export async function POST(request: Request) {
  const wallet = requireWallet(request);
  if (wallet instanceof Response) return wallet;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  return jsonOr502("[profile] mark read failed", async () => {
    const sql = await db();
    const { ids } = parsed.data;
    await (ids
      ? sql`update ${sql(T.notifications)} set read_at = now() where wallet = ${wallet} and read_at is null and id in ${sql(ids)}`
      : sql`update ${sql(T.notifications)} set read_at = now() where wallet = ${wallet} and read_at is null`);
    return { ok: true };
  });
}
