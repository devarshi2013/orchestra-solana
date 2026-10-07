import type { NextRequest } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/env/server";
import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { candleStore, trackMints } from "@/lib/market/store";
import { syncPrices } from "@/lib/market/sync";
import { EXAMPLE_SYMPHONIES } from "@/lib/symphony/examples";
import { collectMints } from "@/lib/symphony/mints";
import { fetchOhlcv, MAX_CANDLES_PER_REQUEST } from "@/server/birdeye/client";
import { isAuthorizedCron } from "@/server/cron";
import { errorResponse, validationErrorResponse } from "@/server/http";

/** Platform limit for this route; the job stops starting new mints well before it. */
export const maxDuration = 300;
const TIME_BUDGET_MS = 240_000;

/** Always kept up to date so the example symphonies can be evaluated. */
const DEFAULT_MINTS = [
  ...new Set(EXAMPLE_SYMPHONIES.flatMap((symphony) => [...collectMints(symphony.root)])),
];

const querySchema = z.object({
  /** Comma-separated mints to start tracking, e.g. ?track=<mint>,<mint>. */
  track: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").map((mint) => mint.trim()) : []))
    .pipe(z.array(base58AddressSchema).max(50)),
});

/**
 * Backfills new mints and appends closed daily + hourly candles for every
 * tracked mint from Birdeye. Idempotent: rerunning only fetches what's missing.
 * Scheduled in vercel.json; see docs/market-data.md.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return errorResponse(401, "Unauthorized");
  }
  if (!serverEnv.BIRDEYE_API_KEY) {
    return errorResponse(503, "BIRDEYE_API_KEY is not configured");
  }
  const parsed = querySchema.safeParse({
    track: request.nextUrl.searchParams.get("track") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await trackMints([...DEFAULT_MINTS, ...parsed.data.track]);
    const started = Date.now();
    const report = await syncPrices({
      ...candleStore,
      fetchCandles: (params) => fetchOhlcv(params, request.signal),
      maxCandlesPerRequest: MAX_CANDLES_PER_REQUEST,
      now: () => Math.floor(Date.now() / 1000),
      outOfTime: () => Date.now() - started > TIME_BUDGET_MS,
    });
    for (const { mint, error } of report.synced) {
      if (error) console.error(`[cron/prices] ${mint}: ${error}`);
    }
    return Response.json(report);
  } catch (error) {
    console.error("[cron/prices] failed", error);
    return errorResponse(500, "Price sync failed");
  }
}
