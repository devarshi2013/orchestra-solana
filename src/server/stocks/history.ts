import "server-only";

import type { ChartWindow } from "@/lib/stocks/api";
import type { Candle } from "@/lib/market/series";
import { cached } from "@/server/cache";
import { fetchCandles, findTopPool, type Resolution } from "@/server/market/coingecko";

/** Each chart window's CoinGecko resolution, and how long its candles are reused. */
const WINDOWS = {
  "24h": { timeframe: "minute", aggregate: 15, limit: 96, ttlMs: 5 * 60_000 },
  "7d": { timeframe: "hour", aggregate: 1, limit: 168, ttlMs: 5 * 60_000 },
  "30d": { timeframe: "hour", aggregate: 4, limit: 180, ttlMs: 30 * 60_000 },
  "90d": { timeframe: "hour", aggregate: 12, limit: 180, ttlMs: 2 * 3_600_000 },
  "1y": { timeframe: "day", aggregate: 1, limit: 365, ttlMs: 6 * 3_600_000 },
} as const satisfies Record<ChartWindow, Resolution & { ttlMs: number }>;

/** A token's busiest pool rarely changes; keeping it a day halves the calls per chart. */
const POOL_TTL_MS = 24 * 3_600_000;

/**
 * Candles for a stock token over `window`, from its top pool on CoinGecko
 * (looked up by mint at request time). Empty when the token has no pool with
 * history, e.g. tokens that only trade through RFQ market makers. Errors
 * (CoinGecko down, rate-limited) are thrown, never cached or filled in.
 */
export function stockCandles(mint: string, window: ChartWindow): Promise<Candle[]> {
  const resolution = WINDOWS[window];
  return cached(`stocks:candles:${mint}:${window}`, resolution.ttlMs, async () => {
    const pool = await cached(`stocks:pool:${mint}`, POOL_TTL_MS, () => findTopPool(mint));
    return pool ? fetchCandles(pool, mint, resolution) : [];
  });
}
