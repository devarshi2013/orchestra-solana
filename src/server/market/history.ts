import "server-only";

import { marketToken, type WindowSpec } from "@/lib/market/config";
import type { Candle } from "@/lib/market/series";
import { cached } from "@/server/cache";

import {
  fetchCandles,
  findTopPool,
  findTopPools,
  GeckoTerminalError,
  MAX_TOKENS_PER_LOOKUP,
  type Priority,
} from "./geckoterminal";

const POOL_TTL_MS = 24 * 3_600_000;

const resolvePool = (mint: string, priority?: Priority) =>
  cached(`market:pool:${mint}`, POOL_TTL_MS, () => findTopPool(mint, undefined, priority));

const primed = new Set<string>();

/**
 * Looks up the pools of many tokens in one call per 30 (instead of one call
 * each) and puts them in the pool cache, so their history loads need only the
 * candle request. Tokens already looked up, or with a configured pool, are skipped.
 */
export async function primePools(mints: readonly string[]): Promise<void> {
  const need = mints.filter((m) => !primed.has(m) && !marketToken(m)?.pool);
  for (let i = 0; i < need.length; i += MAX_TOKENS_PER_LOOKUP) {
    const batch = need.slice(i, i + MAX_TOKENS_PER_LOOKUP);
    const pools = await findTopPools(batch).catch(() => null);
    if (!pools) continue; // each token falls back to its own lookup
    for (const mint of batch) {
      primed.add(mint);
      void cached(`market:pool:${mint}`, POOL_TTL_MS, async () => pools[mint] ?? null);
    }
  }
}

/**
 * One token's history for a window, cached for the window's TTL. Uses the
 * configured pool for dashboard tokens, or the current top pool when there's
 * none or it returns nothing. Callers pass only known mints (dashboard or
 * registry). Throws when no pool has data (failures aren't cached).
 */
export function loadCandles(
  mint: string,
  window: WindowSpec,
  priority: Priority = "background",
): Promise<Candle[]> {
  // A chart someone is waiting on is loaded separately, ahead of the background queue.
  const lane = priority === "now" ? "now:" : "";
  return cached(`market:candles:${lane}${mint}:${window.id}`, window.ttlMs, async () => {
    const token = marketToken(mint);
    let pool = token?.pool ?? (await resolvePool(mint, priority));
    let candles = pool ? await fetchCandles(pool, mint, window, undefined, priority) : [];
    if (candles.length === 0 && token?.pool) {
      pool = await resolvePool(mint, priority);
      if (pool && pool !== token.pool)
        candles = await fetchCandles(pool, mint, window, undefined, priority);
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
