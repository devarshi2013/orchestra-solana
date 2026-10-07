import type { NextRequest } from "next/server";

import { MAX_TEST_QUOTE_IMPACT_PCT, TEST_QUOTE_USD } from "@/lib/assets/config";
import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { USDC_MINT } from "@/lib/tokens";
import { listedAssets } from "@/server/assets/registry";
import { errorResponse, validationErrorResponse } from "@/server/http";
import { paced } from "@/server/jupiter/pace";
import { getOrder } from "@/server/jupiter/swap";

export type LiquidityCheck =
  | { status: "ok" | "thin"; impactPct: number; router: string; testUsd: number }
  | { status: "no_route"; message: string; testUsd: number };

const CACHE_MS = 15 * 60_000;
const cache = new Map<string, { at: number; check: LiquidityCheck }>();

/**
 * GET ?mint=<registry mint> → a test quote of TEST_QUOTE_USD of USDC into the
 * asset (no taker, nothing signed). "thin" when its price impact exceeds
 * MAX_TEST_QUOTE_IMPACT_PCT; "no_route" when Jupiter can't quote it at all.
 */
export async function GET(request: NextRequest) {
  const mint = base58AddressSchema.safeParse(request.nextUrl.searchParams.get("mint"));
  if (!mint.success) return validationErrorResponse(mint.error);
  if (!(await listedAssets()).isListed(mint.data))
    return errorResponse(404, "Not in the asset registry");
  if (mint.data === USDC_MINT) return errorResponse(400, "USDC is the quote currency");

  const hit = cache.get(mint.data);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.check);
  let check: LiquidityCheck;
  try {
    const order = await paced(() =>
      getOrder({
        inputMint: USDC_MINT,
        outputMint: mint.data,
        amount: String(TEST_QUOTE_USD * 1_000_000),
      }),
    );
    const impactPct = Math.abs(order.priceImpact ?? 0);
    check = {
      status: impactPct > MAX_TEST_QUOTE_IMPACT_PCT ? "thin" : "ok",
      impactPct,
      router: order.router,
      testUsd: TEST_QUOTE_USD,
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 429) return errorResponse(429, "Rate limited; try again shortly");
    check = {
      status: "no_route",
      message: "Jupiter couldn't quote this trade right now",
      testUsd: TEST_QUOTE_USD,
    };
  }
  cache.set(mint.data, { at: Date.now(), check });
  return Response.json(check);
}
