import type { NextRequest } from "next/server";
import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { loadDailyMarketData } from "@/lib/market/store";
import { errorResponse, validationErrorResponse } from "@/server/http";

const querySchema = z.object({
  mints: z
    .string()
    .transform((value) => [...new Set(value.split(",").map((mint) => mint.trim()))])
    .pipe(z.array(base58AddressSchema).min(1).max(50)),
});

/**
 * Stored daily closes for `?mints=<mint>,<mint>`, aligned for evaluate() and
 * the backtester. Only what the cron job has stored; never calls a provider.
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ mints: request.nextUrl.searchParams.get("mints") ?? "" });
  if (!parsed.success) return validationErrorResponse(parsed.error);
  try {
    return Response.json(await loadDailyMarketData(parsed.data.mints));
  } catch (error) {
    console.error("[market-data] load failed", error);
    return errorResponse(500, "Couldn't load price history");
  }
}
