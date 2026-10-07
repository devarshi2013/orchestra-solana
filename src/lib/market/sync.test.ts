import { describe, expect, it } from "vitest";

import type { Candle, CandleInterval } from "./candles";
import { syncPrices, type SyncDeps } from "./sync";

const BACKFILL_DAYS = { "1D": 3 * 365, "1H": 90 };

const DAY = 86_400;
const HOUR = 3_600;
const JUN_1 = Date.UTC(2026, 5, 1) / 1000;
const NOW = JUN_1 + 10 * HOUR + 5 * 60; // 2026-06-01 10:05 UTC

/** A provider with a candle at every interval since `listedAt` (including the open one). */
function fakeDeps(options: {
  mints: string[];
  listedAt?: Record<string, number>;
  failing?: string[];
  stored?: Candle[];
  outOfTimeAfter?: number;
}) {
  const stored = [...(options.stored ?? [])];
  const requests: { mint: string; interval: CandleInterval; from: number; to: number }[] = [];
  const marks: [string, string | null][] = [];
  let started = 0;
  const deps: SyncDeps = {
    listTrackedMints: async () => options.mints,
    latestOpenTime: async (mint, interval) => {
      const times = stored
        .filter((c) => c.mint === mint && c.interval === interval)
        .map((c) => c.openTime);
      return times.length ? Math.max(...times) : null;
    },
    insertCandles: async (candles) => {
      const fresh = candles.filter(
        (c) =>
          !stored.some(
            (s) => s.mint === c.mint && s.interval === c.interval && s.openTime === c.openTime,
          ),
      );
      stored.push(...fresh);
      return fresh.length;
    },
    markSynced: async (mint, error) => void marks.push([mint, error]),
    fetchCandles: async (params) => {
      requests.push(params);
      if (options.failing?.includes(params.mint)) throw new Error("Birdeye API 500: boom");
      const width = params.interval === "1D" ? DAY : HOUR;
      const listedAt = options.listedAt?.[params.mint] ?? 0;
      const candles: Candle[] = [];
      // Like Birdeye, include the still-open candle at the end of the range.
      for (
        let t = Math.max(params.from, listedAt);
        t <= Math.max(params.to, NOW - (NOW % width));
        t += width
      ) {
        candles.push({
          mint: params.mint,
          interval: params.interval,
          openTime: t,
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 0,
          volumeUsd: null,
        });
      }
      return candles;
    },
    maxCandlesPerRequest: 5000,
    backfillDays: BACKFILL_DAYS,
    now: () => NOW,
    outOfTime: () => started++ >= (options.outOfTimeAfter ?? Infinity),
  };
  return { deps, stored, requests, marks };
}

describe("syncPrices", () => {
  it("backfills closed daily and hourly candles on first sync", async () => {
    const { deps, stored, requests } = fakeDeps({ mints: ["SOL"] });
    const report = await syncPrices(deps);

    expect(report).toEqual({
      synced: [
        {
          mint: "SOL",
          inserted: { "1D": BACKFILL_DAYS["1D"], "1H": BACKFILL_DAYS["1H"] * 24 },
        },
      ],
      deferred: [],
    });
    expect(requests).toEqual([
      { mint: "SOL", interval: "1D", from: JUN_1 - BACKFILL_DAYS["1D"] * DAY, to: JUN_1 - DAY },
      {
        mint: "SOL",
        interval: "1H",
        from: JUN_1 - BACKFILL_DAYS["1H"] * DAY + 10 * HOUR,
        to: JUN_1 + 9 * HOUR,
      },
    ]);
    // The open 10:00 hourly and today's daily candle are not stored.
    expect(stored.some((c) => c.openTime >= JUN_1 + 10 * HOUR)).toBe(false);
    expect(stored.some((c) => c.interval === "1D" && c.openTime === JUN_1)).toBe(false);
  });

  it("appends only candles after the latest stored one", async () => {
    const last: Candle = {
      mint: "SOL",
      interval: "1D",
      openTime: JUN_1 - 3 * DAY,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 0,
      volumeUsd: null,
    };
    const { deps, requests } = fakeDeps({ mints: ["SOL"], stored: [last] });
    const report = await syncPrices(deps, ["1D"]);
    expect(report.synced[0]!.inserted).toEqual({ "1D": 2 });
    expect(requests).toEqual([
      { mint: "SOL", interval: "1D", from: JUN_1 - 2 * DAY, to: JUN_1 - DAY },
    ]);
  });

  it("makes no request when already up to date", async () => {
    const last: Candle = {
      mint: "SOL",
      interval: "1D",
      openTime: JUN_1 - DAY,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 0,
      volumeUsd: null,
    };
    const { deps, requests } = fakeDeps({ mints: ["SOL"], stored: [last] });
    expect((await syncPrices(deps, ["1D"])).synced[0]!.inserted).toEqual({ "1D": 0 });
    expect(requests).toEqual([]);
  });

  it("stores whatever history a newly listed token has", async () => {
    const { deps } = fakeDeps({ mints: ["NEW"], listedAt: { NEW: JUN_1 - 5 * DAY } });
    const report = await syncPrices(deps, ["1D"]);
    expect(report.synced[0]!.inserted).toEqual({ "1D": 5 });
  });

  it("splits long backfills into requests of at most maxCandlesPerRequest", async () => {
    const { deps, requests } = fakeDeps({ mints: ["SOL"] });
    deps.maxCandlesPerRequest = 1000;
    await syncPrices(deps, ["1H"]);
    expect(requests).toHaveLength(Math.ceil((BACKFILL_DAYS["1H"] * 24) / 1000));
  });

  it("records a failing mint and carries on with the rest", async () => {
    const { deps, marks } = fakeDeps({ mints: ["BAD", "SOL"], failing: ["BAD"] });
    const report = await syncPrices(deps, ["1D"]);
    expect(report.synced).toEqual([
      { mint: "BAD", inserted: {}, error: "Birdeye API 500: boom" },
      { mint: "SOL", inserted: { "1D": BACKFILL_DAYS["1D"] } },
    ]);
    expect(marks).toEqual([
      ["BAD", "Birdeye API 500: boom"],
      ["SOL", null],
    ]);
  });

  it("defers mints once out of time", async () => {
    const { deps, marks } = fakeDeps({ mints: ["A", "B", "C"], outOfTimeAfter: 1 });
    const report = await syncPrices(deps, ["1D"]);
    expect(report.synced.map((r) => r.mint)).toEqual(["A"]);
    expect(report.deferred).toEqual(["B", "C"]);
    expect(marks.map(([mint]) => mint)).toEqual(["A"]);
  });

  it("reports non-Error throws as strings", async () => {
    const { deps } = fakeDeps({ mints: ["SOL"] });
    deps.fetchCandles = async () => {
      throw "socket hang up";
    };
    expect((await syncPrices(deps, ["1D"])).synced[0]!.error).toBe("socket hang up");
  });
});
