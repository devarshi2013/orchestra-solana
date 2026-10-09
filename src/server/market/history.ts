import "server-only";

import { marketToken, type WindowSpec } from "@/lib/market/config";
import type { Candle } from "@/lib/market/series";
import { cached } from "@/server/cache";

import { fetchCandles, findTopPool, GeckoTerminalError } from "./geckoterminal";

const POOL_TTL_MS = 24 * 3_600_000;

const resolvePool = (mint: string) =>
  cached(`market:pool:${mint}`, POOL_TTL_MS, () => findTopPool(mint));

/**
 * One token's history for a window, cached for the window's TTL. Uses the
 * configured pool for dashboard tokens, or the current top pool when there's
 * none or it returns nothing. Callers pass only known mints (dashboard or
 * registry). Throws when no pool has data (failures aren't cached).
 */
export function loadCandles(mint: string, window: WindowSpec): Promise<Candle[]> {
  return cached(`market:candles:${mint}:${window.id}`, window.ttlMs, async () => {
    const token = marketToken(mint);
    let pool = token?.pool ?? (await resolvePool(mint));
    let candles = pool ? await fetchCandles(pool, mint, window) : [];
    if (candles.length === 0 && token?.pool) {
      pool = await resolvePool(mint);
      if (pool && pool !== token.pool) candles = await fetchCandles(pool, mint, window);
    }
    if (candles.length === 0) throw new Error("No price history found");
    return candles;
  });
}

export type HistoryResult = {
  /** Mint → candles, oldest first. */
  series: Record<string, Candle[]>;
  /** Still loading: ask again shortly. */
  pending: string[];
  /** Mint → why there's no history. */
  failed: Record<string, string>;
};

/**
 * History for several tokens, answering within `budgetMs`. Every load starts
 * at once (the GeckoTerminal client spaces the actual calls); anything not
 * ready by the deadline keeps loading into the cache and is reported pending.
 */
export async function getHistory(
  mints: readonly string[],
  window: WindowSpec,
  budgetMs = 8_000,
): Promise<HistoryResult> {
  const result: HistoryResult = { series: {}, pending: [], failed: {} };
  const deadline = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), budgetMs),
  );
  await Promise.all(
    mints.map(async (mint) => {
      const load = loadCandles(mint, window);
      load.catch(() => {}); // a load that outlives the deadline must not be an unhandled rejection
      try {
        const outcome = await Promise.race([load, deadline]);
        if (outcome === "timeout") result.pending.push(mint);
        else result.series[mint] = outcome;
      } catch (error) {
        const rateLimited = error instanceof GeckoTerminalError && error.status === 429;
        if (rateLimited) result.pending.push(mint);
        else result.failed[mint] = error instanceof Error ? error.message : "History unavailable";
      }
    }),
  );
  return result;
}
