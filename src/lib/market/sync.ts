import {
  candleOpenAt,
  INTERVAL_SECONDS,
  isClosed,
  planWindows,
  type Candle,
  type CandleInterval,
} from "./candles";

/**
 * The backfill-and-append job behind /api/cron/prices. Storage and the
 * history provider are injected so the logic is testable without Postgres or
 * network; see store.ts and server/birdeye for the real ones.
 */

/** How far back a mint's first sync reaches. Hourly is kept short to save compute units. */
export const BACKFILL_DAYS: Record<CandleInterval, number> = { "1D": 3 * 365, "1H": 90 };

export type SyncDeps = {
  /** Tracked mints, least recently synced first so a starved mint goes next. */
  listTrackedMints(): Promise<string[]>;
  latestOpenTime(mint: string, interval: CandleInterval): Promise<number | null>;
  /** Inserts candles, ignoring ones already stored; returns how many were new. */
  insertCandles(candles: Candle[]): Promise<number>;
  markSynced(mint: string, error: string | null): Promise<void>;
  fetchCandles(params: {
    mint: string;
    interval: CandleInterval;
    from: number;
    to: number;
  }): Promise<Candle[]>;
  maxCandlesPerRequest: number;
  /** Unix seconds. */
  now(): number;
  /** Stop starting new mints once this returns true (serverless time limits). */
  outOfTime(): boolean;
};

export type MintSyncResult = {
  mint: string;
  inserted: Partial<Record<CandleInterval, number>>;
  error?: string;
};

export type SyncReport = {
  synced: MintSyncResult[];
  /** Not reached this run; they sort first next run. */
  deferred: string[];
};

export async function syncPrices(
  deps: SyncDeps,
  intervals: readonly CandleInterval[] = ["1D", "1H"],
): Promise<SyncReport> {
  const mints = await deps.listTrackedMints();
  const report: SyncReport = { synced: [], deferred: [] };
  for (const mint of mints) {
    if (deps.outOfTime()) {
      report.deferred.push(mint);
      continue;
    }
    const result: MintSyncResult = { mint, inserted: {} };
    try {
      for (const interval of intervals) {
        result.inserted[interval] = await syncSeries(deps, mint, interval);
      }
      await deps.markSynced(mint, null);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      await deps.markSynced(mint, result.error);
    }
    report.synced.push(result);
  }
  return report;
}

/**
 * Appends every closed candle after the latest stored one; with nothing
 * stored, backfills BACKFILL_DAYS first. Only closed candles are stored, so a
 * row never changes after it is written.
 */
async function syncSeries(deps: SyncDeps, mint: string, interval: CandleInterval): Promise<number> {
  const now = deps.now();
  const width = INTERVAL_SECONDS[interval];
  const lastClosed = candleOpenAt(now, interval) - width;
  const latest = await deps.latestOpenTime(mint, interval);
  const from =
    latest !== null
      ? latest + width
      : candleOpenAt(now - BACKFILL_DAYS[interval] * INTERVAL_SECONDS["1D"], interval);

  let inserted = 0;
  for (const window of planWindows(from, lastClosed, interval, deps.maxCandlesPerRequest)) {
    const candles = await deps.fetchCandles({ mint, interval, ...window });
    const fresh = candles.filter(
      (c) =>
        c.openTime >= window.from && c.openTime <= window.to && isClosed(c.openTime, interval, now),
    );
    if (fresh.length > 0) inserted += await deps.insertCandles(fresh);
  }
  return inserted;
}
