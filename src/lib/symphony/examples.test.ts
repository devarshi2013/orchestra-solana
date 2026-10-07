import { describe, expect, it } from "vitest";

import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

import { evaluate } from "./evaluate";
import {
  BONK_MINT,
  JTO_MINT,
  JUP_MINT,
  PYTH_MINT,
  RAY_MINT,
  solanaMomentumTop3,
  solJup6040,
  solTrendFollower,
} from "./examples";
import type { MarketData } from "./market-data";

const DAYS = 60;
const dates = Array.from({ length: DAYS }, (_, i) =>
  new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
);
/** A series compounding `dailyPct` percent a day. */
const trend = (dailyPct: number) => dates.map((_, i) => 100 * (1 + dailyPct / 100) ** i);
const last = dates[DAYS - 1]!;

describe("example symphonies", () => {
  it("trend follower holds SOL above its SMA(50) and USDC below it", () => {
    const up: MarketData = { dates, closes: { [SOL_MINT]: trend(1) } };
    const down: MarketData = { dates, closes: { [SOL_MINT]: trend(-1) } };
    expect(evaluate(solTrendFollower.root, up, last)).toEqual({ [SOL_MINT]: 1 });
    expect(evaluate(solTrendFollower.root, down, last)).toEqual({ [USDC_MINT]: 1 });
  });

  it("momentum filter holds the three best 30-day performers", () => {
    const data: MarketData = {
      dates,
      closes: {
        [SOL_MINT]: trend(0.5),
        [JUP_MINT]: trend(2),
        [BONK_MINT]: trend(-1),
        [JTO_MINT]: trend(1),
        [PYTH_MINT]: trend(0),
        [RAY_MINT]: trend(1.5),
      },
    };
    expect(evaluate(solanaMomentumTop3.root, data, last)).toEqual({
      [JUP_MINT]: 1 / 3,
      [RAY_MINT]: 1 / 3,
      [JTO_MINT]: 1 / 3,
    });
  });

  it("60/40 needs no market data", () => {
    expect(evaluate(solJup6040.root, { dates: [], closes: {} }, last)).toEqual({
      [SOL_MINT]: 0.6,
      [JUP_MINT]: 0.4,
    });
  });
});
