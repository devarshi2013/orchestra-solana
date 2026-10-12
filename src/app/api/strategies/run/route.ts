import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { serverEnv } from "@/env";
import { strategiesConfigured, strategiesOff } from "@/server/db";
import { errorResponse, jsonOr502 } from "@/server/http";
import { runWatcher } from "@/server/strategies/run";

/**
 * The strategy watcher, called every minute with `Authorization: Bearer
 * CRON_SECRET` (Vercel Cron sends a GET with that header; any scheduler can POST).
 */
async function run(request: NextRequest) {
  if (!strategiesConfigured()) return strategiesOff();
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return errorResponse(503, "The watcher is off (needs CRON_SECRET)");
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return errorResponse(401, "Unauthorized");
  }
  return jsonOr502("[strategies] watcher failed", () => runWatcher(request.nextUrl.origin));
}

export const GET = run;
export const POST = run;
