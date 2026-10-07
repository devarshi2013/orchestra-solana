import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/env/server";

/**
 * Whether `authorization` carries the cron secret (`Bearer <CRON_SECRET>`, as
 * Vercel Cron sends it). Without a secret configured, cron routes are open in
 * development and closed in production.
 */
export function isAuthorizedCron(
  authorization: string | null,
  secret: string | undefined = serverEnv.CRON_SECRET,
  nodeEnv: string = serverEnv.NODE_ENV,
): boolean {
  if (!secret) return nodeEnv !== "production";
  if (!authorization) return false;
  // Hash both sides so the comparison is constant-time regardless of length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
