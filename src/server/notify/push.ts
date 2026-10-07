import "server-only";

import webpush from "web-push";

import { clientEnv } from "@/env/client";
import { serverEnv } from "@/env/server";
import { db } from "@/server/db";

export const pushConfigured = () =>
  Boolean(
    clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    serverEnv.VAPID_PRIVATE_KEY &&
    serverEnv.VAPID_SUBJECT,
  );

/**
 * Sends a notification to every browser `owner` subscribed. Expired endpoints
 * (404/410) are deleted. Returns how many deliveries succeeded.
 */
export async function pushToOwner(
  owner: string,
  payload: { title: string; body: string; url: string },
): Promise<number> {
  if (!pushConfigured()) return 0;
  webpush.setVapidDetails(
    serverEnv.VAPID_SUBJECT!,
    clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    serverEnv.VAPID_PRIVATE_KEY!,
  );
  const subscriptions = await db.pushSubscription.findMany({ where: { owner } });
  let delivered = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      delivered++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
      } else {
        console.error("[push] delivery failed", status, error);
      }
    }
  }
  return delivered;
}
