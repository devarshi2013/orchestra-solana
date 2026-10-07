import { z } from "zod";

import { db } from "@/server/db";
import { handle, readJson, requireWallet } from "@/server/invest/route";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** POST a browser PushSubscription for the signed-in wallet. */
export async function POST(request: Request) {
  return handle(async () => {
    const owner = await requireWallet();
    const { endpoint, keys } = await readJson(request, subscriptionSchema);
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, owner, p256dh: keys.p256dh, auth: keys.auth },
      update: { owner, p256dh: keys.p256dh, auth: keys.auth },
    });
    return Response.json({ ok: true });
  });
}

/** DELETE { endpoint } → unsubscribes that browser. */
export async function DELETE(request: Request) {
  return handle(async () => {
    const owner = await requireWallet();
    const { endpoint } = await readJson(request, z.object({ endpoint: z.string().max(2000) }));
    await db.pushSubscription.deleteMany({ where: { endpoint, owner } });
    return Response.json({ ok: true });
  });
}
