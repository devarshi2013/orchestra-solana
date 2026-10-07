import "server-only";

import type { MarketData } from "@/lib/symphony/market-data";
import { db } from "@/server/db";
import { CandleInterval as DbInterval } from "@/generated/prisma/client";

import { toMarketData, type Candle, type CandleInterval } from "./candles";
import type { SyncDeps } from "./sync";

/** Postgres persistence for candles and tracked mints (prisma/schema.prisma). */

const toDb: Record<CandleInterval, DbInterval> = { "1D": DbInterval.D1, "1H": DbInterval.H1 };
const fromDb: Record<DbInterval, CandleInterval> = { D1: "1D", H1: "1H" };

export async function trackMints(mints: readonly string[]): Promise<void> {
  await db.trackedMint.createMany({
    data: mints.map((mint) => ({ mint })),
    skipDuplicates: true,
  });
}

export const candleStore: Pick<
  SyncDeps,
  "listTrackedMints" | "latestOpenTime" | "insertCandles" | "markSynced"
> = {
  async listTrackedMints() {
    const rows = await db.trackedMint.findMany({
      orderBy: [{ lastSyncAt: { sort: "asc", nulls: "first" } }, { mint: "asc" }],
      select: { mint: true },
    });
    return rows.map((row) => row.mint);
  },

  async latestOpenTime(mint, interval) {
    const row = await db.candle.findFirst({
      where: { mint, interval: toDb[interval] },
      orderBy: { openTime: "desc" },
      select: { openTime: true },
    });
    return row ? row.openTime.getTime() / 1000 : null;
  },

  async insertCandles(candles) {
    const { count } = await db.candle.createMany({
      data: candles.map((c) => ({
        ...c,
        interval: toDb[c.interval],
        openTime: new Date(c.openTime * 1000),
      })),
      skipDuplicates: true,
    });
    return count;
  },

  async markSynced(mint, error) {
    await db.trackedMint.update({
      where: { mint },
      data: { lastSyncAt: new Date(), lastError: error },
    });
  },
};

export async function loadCandles(
  mints: readonly string[],
  interval: CandleInterval,
): Promise<Candle[]> {
  const rows = await db.candle.findMany({
    where: { mint: { in: [...mints] }, interval: toDb[interval] },
    orderBy: { openTime: "asc" },
  });
  return rows.map((row) => ({
    ...row,
    interval: fromDb[row.interval],
    openTime: row.openTime.getTime() / 1000,
  }));
}

/** All stored daily history for `mints`, aligned for evaluate(). */
export async function loadDailyMarketData(mints: readonly string[]): Promise<MarketData> {
  return toMarketData(await loadCandles(mints, "1D"), mints);
}
