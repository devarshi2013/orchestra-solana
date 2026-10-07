import { describe, expect, it } from "vitest";

import { JUP_MINT } from "@/lib/symphony/examples";
import type { MarketData } from "@/lib/symphony/market-data";
import type { Symphony, SymphonyNode } from "@/lib/symphony/types";
import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

import { BacktestError, runBacktest } from "./engine";
import type { BacktestConfig, RebalanceRule } from "./types";

/**
 * The hand-verified scenario: two assets, five daily closes.
 *
 *   day          d0   d1   d2    d3    d4
 *   SOL close   100  110   99    99  108.9
 *   JUP close     1    1  1.2   1.2    0.6
 *
 * Trading starts on d1, filling at d0's close; equity is marked at each close.
 */
const DATES = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"];
const DATA: MarketData = {
  dates: DATES,
  closes: { [SOL_MINT]: [100, 110, 99, 99, 108.9], [JUP_MINT]: [1, 1, 1.2, 1.2, 0.6] },
};

const symphony = (root: SymphonyNode): Symphony => ({ version: 1, name: "test", root });
const fiftyFifty = symphony({
  type: "group",
  name: "50/50",
  weight: { method: "equal" },
  children: [
    { type: "asset", mint: SOL_MINT },
    { type: "asset", mint: JUP_MINT },
  ],
});
const config = (overrides: Partial<BacktestConfig> = {}): BacktestConfig => ({
  startDate: DATES[1]!,
  endDate: DATES[4]!,
  rebalance: { kind: "daily" },
  startingCapitalUsdc: 1000,
  feeBps: 0,
  slippageBps: 0,
  ...overrides,
});
const values = (result: ReturnType<typeof runBacktest>) => result.equity.map((p) => p.value);
const close = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 9));
};

describe("runBacktest: hand-verified 2-asset, 5-day scenario", () => {
  it("rebalances 50/50 daily without costs", () => {
    const result = runBacktest(fiftyFifty, DATA, config());
    // d1: fill at d0 → 500/100 = 5 SOL, 500/1 = 500 JUP. Close: 5·110 + 500·1      = 1050
    // d2: fill at d1 → 525 each: 4.7727… SOL, 525 JUP.     Close: 472.5 + 525·1.2  = 1102.5
    // d3: fill at d2 → 551.25 each: 5.5681… SOL, 459.375 JUP. Close: 551.25·2      = 1102.5
    // d4: fill at d3 → already 50/50, no trades.          Close: 606.375 + 275.625 = 882
    close(values(result), [1000, 1050, 1102.5, 1102.5, 882]);
    // Benchmark: 1000 / 100 = 10 SOL held throughout.
    close(
      result.equity.map((p) => p.benchmark!),
      [1000, 1100, 990, 990, 1089],
    );
    expect(result.equity.map((p) => p.date)).toEqual(DATES);

    expect(result.rebalances.map((r) => [r.date, r.decidedOn, r.trades.length])).toEqual([
      [DATES[1], DATES[0], 2],
      [DATES[2], DATES[1], 2],
      [DATES[3], DATES[2], 2],
      [DATES[4], DATES[3], 0],
    ]);
    const [first, second] = result.rebalances;
    expect(first!.trades).toEqual([
      { mint: SOL_MINT, side: "buy", units: 5, price: 100, usdc: 500, cost: 0 },
      { mint: JUP_MINT, side: "buy", units: 500, price: 1, usdc: 500, cost: 0 },
    ]);
    // d2 sells SOL worth 550 − 525 = 25 at 110 and buys 25 of JUP.
    expect(second!.trades.map((t) => [t.mint, t.side, t.usdc])).toEqual([
      [SOL_MINT, "sell", expect.closeTo(25, 9)],
      [JUP_MINT, "buy", expect.closeTo(25, 9)],
    ]);
    expect(result.totalCost).toBe(0);
  });

  it("charges fee and slippage on every fill", () => {
    const fee = 0.001; // 10 bps
    const slip = 0.002; // 20 bps
    const result = runBacktest(
      fiftyFifty,
      DATA,
      config({ rebalance: { kind: "monthly" }, feeBps: 10, slippageBps: 20 }),
    );
    // Only d1 trades (one month). Each leg spends 500 USDC:
    // units = 500·(1 − fee) / (price·(1 + slip)).
    const sol = (500 * (1 - fee)) / (100 * (1 + slip));
    const jup = (500 * (1 - fee)) / (1 * (1 + slip));
    close(values(result), [
      1000,
      sol * 110 + jup * 1,
      sol * 99 + jup * 1.2,
      sol * 99 + jup * 1.2,
      sol * 108.9 + jup * 0.6,
    ]);
    // Cost = USDC spent − value of the units at the close they filled against.
    expect(result.totalCost).toBeCloseTo(1000 - (sol * 100 + jup * 1), 9);
    // The benchmark pays the same costs once.
    const benchmarkSol = (1000 * (1 - fee)) / (100 * (1 + slip));
    expect(result.equity[4]!.benchmark).toBeCloseTo(benchmarkSol * 108.9, 9);
  });

  it("scales buys down when sell costs leave too little cash", () => {
    const fee = 0.001;
    const slip = 0.002;
    const result = runBacktest(
      fiftyFifty,
      DATA,
      config({ endDate: DATES[2]!, feeBps: 10, slippageBps: 20 }),
    );
    // After d1 (as above), d2 fills at d1's close: SOL 110, JUP 1.
    let sol = (500 * (1 - fee)) / (100 * (1 + slip));
    let jup = (500 * (1 - fee)) / (1 * (1 + slip));
    const total = sol * 110 + jup;
    const soldSol = (sol * 110 - total / 2) / 110;
    const proceeds = soldSol * 110 * (1 - slip) * (1 - fee);
    // JUP wants total/2 − jup, more than `proceeds`, so it gets all the proceeds.
    expect(total / 2 - jup).toBeGreaterThan(proceeds);
    sol -= soldSol;
    jup += (proceeds * (1 - fee)) / (1 * (1 + slip));
    close(values(result).slice(2), [sol * 99 + jup * 1.2]);
  });

  it("decides each day on the previous close only (no look-ahead)", () => {
    // Hold SOL once it trades above 105, else JUP. SOL first closes above 105 on d1.
    const momentum = symphony({
      type: "if",
      condition: {
        left: { mint: SOL_MINT, indicator: { fn: "price" } },
        comparator: "gt",
        right: 105,
      },
      then: { type: "asset", mint: SOL_MINT },
      else: { type: "asset", mint: JUP_MINT },
    });
    const result = runBacktest(momentum, DATA, config());
    // d1 can only see d0 (SOL 100) → JUP. Peeking at d1's 110 would have picked SOL.
    expect(result.rebalances[0]!.target).toEqual({ [JUP_MINT]: 1 });
    expect(result.rebalances[1]!.target).toEqual({ [SOL_MINT]: 1 });
    // d1 equity moves with JUP (1 → 1), not SOL (100 → 110).
    expect(result.equity[1]!.value).toBeCloseTo(1000, 9);
    // d2 switches to SOL at d1's 110, then SOL falls to 99: 1000 · 99/110 = 900.
    expect(result.equity[2]!.value).toBeCloseTo(900, 9);
  });

  it.each([
    [{ kind: "threshold", driftPct: 2 }, [DATES[1], DATES[2], DATES[3]]],
    [{ kind: "threshold", driftPct: 5 }, [DATES[1]]],
  ] satisfies [RebalanceRule, unknown[]][])(
    "%o trades only when weights drift past the threshold",
    (rebalance, tradedOn) => {
      // Drift before each day's fill: d2 2.4pp (550 vs 500), d3 4.8pp (495 vs 600)
      // without a d2 trade, or 7.1pp (472.5 vs 630) after one; d4 0 after a d3 trade.
      const result = runBacktest(fiftyFifty, DATA, config({ rebalance }));
      expect(result.rebalances.map((r) => r.date)).toEqual(tradedOn);
    },
  );
});

describe("runBacktest: edges", () => {
  it("keeps the weight of unpriced or USDC targets in cash", () => {
    const UNLISTED = "Unlisted11111111111111111111111111111111111";
    const result = runBacktest(
      symphony({
        type: "group",
        name: "g",
        weight: { method: "equal" },
        children: [
          { type: "asset", mint: UNLISTED },
          { type: "asset", mint: USDC_MINT },
        ],
      }),
      DATA,
      config(),
    );
    expect(result.rebalances[0]).toMatchObject({
      target: { [USDC_MINT]: 1 },
      unpriced: [UNLISTED],
      trades: [],
      weightsAfter: { [USDC_MINT]: 1 },
    });
    close(values(result), [1000, 1000, 1000, 1000, 1000]);
  });

  it("starts on the second stored day when the range begins earlier", () => {
    const result = runBacktest(fiftyFifty, DATA, config({ startDate: "2020-01-01" }));
    expect(result.equity[0]!.date).toBe(DATES[0]);
    expect(result.rebalances[0]!.date).toBe(DATES[1]);
  });

  it("values a holding at its last close when a day's close is missing", () => {
    const gappy: MarketData = {
      dates: DATES,
      closes: { [SOL_MINT]: DATA.closes[SOL_MINT]!, [JUP_MINT]: [1, 1, null, 1.2, 0.6] },
    };
    const jupOnly = symphony({ type: "asset", mint: JUP_MINT });
    // 1000 JUP bought at 1; d2 has no close, so it is still worth 1000.
    close(
      values(runBacktest(jupOnly, gappy, config({ rebalance: { kind: "monthly" } }))),
      [1000, 1000, 1000, 1200, 600],
    );
  });

  it("has no benchmark without SOL prices", () => {
    const noSol: MarketData = { dates: DATES, closes: { [JUP_MINT]: DATA.closes[JUP_MINT]! } };
    const jupOnly = symphony({ type: "asset", mint: JUP_MINT });
    const result = runBacktest(jupOnly, noSol, config());
    expect(result.benchmark).toBeNull();
    expect(result.equity.every((p) => p.benchmark === null)).toBe(true);
  });

  it.each([
    ["after the data", { startDate: "2027-01-01", endDate: "2027-02-01" }],
    ["before a prior close exists", { startDate: DATES[0]!, endDate: DATES[0]! }],
  ])("rejects a range %s, naming the stored span", (_, range) => {
    expect(() => runBacktest(fiftyFifty, DATA, config(range))).toThrow(
      "Stored prices cover 2026-03-01 to 2026-03-05.",
    );
  });

  it("rejects a backtest with no stored prices", () => {
    expect(() => runBacktest(fiftyFifty, { dates: [], closes: {} }, config())).toThrow(
      BacktestError,
    );
  });

  it("reports metrics for the strategy and the benchmark", () => {
    const result = runBacktest(fiftyFifty, DATA, config());
    expect(result.metrics.totalReturn).toBeCloseTo(-0.118, 9);
    expect(result.metrics.maxDrawdown).toBeCloseTo(0.2, 9);
    expect(result.benchmark!.totalReturn).toBeCloseTo(0.089, 9);
  });
});
