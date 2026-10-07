import "server-only";

import { serverEnv } from "@/env/server";
import * as birdeye from "@/server/birdeye/client";
import * as geckoterminal from "@/server/geckoterminal/client";

import { getPricePool, setPricePool } from "./store";
import type { SyncDeps } from "./sync";

export type PriceSource = Pick<
  SyncDeps,
  "fetchCandles" | "maxCandlesPerRequest" | "backfillDays"
> & { name: "birdeye" | "geckoterminal" };

/**
 * Where candle history comes from: Birdeye when BIRDEYE_API_KEY is set,
 * otherwise keyless GeckoTerminal. See docs/market-data.md.
 */
export function priceSource(signal?: AbortSignal): PriceSource {
  if (serverEnv.BIRDEYE_API_KEY) {
    return {
      name: "birdeye",
      fetchCandles: (params) => birdeye.fetchOhlcv(params, signal),
      maxCandlesPerRequest: birdeye.MAX_CANDLES_PER_REQUEST,
      backfillDays: { "1D": 3 * 365, "1H": 90 },
    };
  }
  return {
    name: "geckoterminal",
    fetchCandles: async (params) => {
      const pool = await poolFor(params.mint, signal);
      return geckoterminal.fetchPoolOhlcv({ ...params, pool }, signal);
    },
    maxCandlesPerRequest: geckoterminal.MAX_CANDLES_PER_REQUEST,
    // Daily: a day inside the keyless limit, so the oldest request is never
    // refused. Hourly: 41 days = one 1,000-candle request, to spare the rate limit.
    backfillDays: { "1D": geckoterminal.HISTORY_DAYS - 1, "1H": 41 },
  };
}

/** Picks a mint's pool once and saves it, so its price series never switches pools. */
async function poolFor(mint: string, signal?: AbortSignal): Promise<string> {
  const saved = await getPricePool(mint);
  if (saved) return saved;
  const pool = await geckoterminal.findPricePool(mint, signal);
  await setPricePool(mint, pool);
  return pool;
}
