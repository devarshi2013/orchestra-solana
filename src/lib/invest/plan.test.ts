import { describe, expect, it } from "vitest";

import { JUP_MINT } from "@/lib/symphony/examples";
import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

import { investableBase, planRebalance, realizedPrice, sizeLeg, toBaseUnits } from "./plan";

const sol = (units: number) => ({ amount: toBaseUnits(units, 9).toString(), decimals: 9 });
const jup = (units: number) => ({ amount: toBaseUnits(units, 6).toString(), decimals: 6 });
const usdc = (units: number) => ({ amount: toBaseUnits(units, 6).toString(), decimals: 6 });
const prices = { [SOL_MINT]: 100, [JUP_MINT]: 0.5 };
const universe = [SOL_MINT, JUP_MINT, USDC_MINT];

describe("toBaseUnits", () => {
  it("rounds down to whole base units", () => {
    expect(toBaseUnits(1.5, 9)).toBe(1_500_000_000n);
    expect(toBaseUnits(0.1234567, 6)).toBe(123_456n);
    expect(toBaseUnits(0, 6)).toBe(0n);
    expect(toBaseUnits(-1, 6)).toBe(0n);
    expect(toBaseUnits(0.9999999, 6)).toBe(999_999n); // toFixed would round up to 1.000000
  });

  it("keeps the SOL fee reserve out of what can be traded", () => {
    expect(investableBase(SOL_MINT, sol(1))).toBe(980_000_000n);
    expect(investableBase(SOL_MINT, sol(0.01))).toBe(0n);
    expect(investableBase(JUP_MINT, jup(5))).toBe(5_000_000n);
    expect(investableBase(JUP_MINT, undefined)).toBe(0n);
  });
});

describe("planRebalance", () => {
  it("nets a 60/40 target through USDC: sells first, then buys", () => {
    // Wallet: 10.02 SOL ($1,000 investable after the 0.02 reserve) + $1,000 USDC.
    const plan = planRebalance({
      balances: { [SOL_MINT]: sol(10.02), [USDC_MINT]: usdc(1000) },
      prices,
      target: { [SOL_MINT]: 0.6, [JUP_MINT]: 0.4 },
      universe,
      driftThresholdPct: 0,
    });
    expect(plan.totalUsd).toBeCloseTo(2000, 9);
    // SOL: target $1,200, holds $1,000 → buy $200. JUP: buy $800. USDC: sold down to 0.
    expect(plan.legs.map((l) => [l.side, l.mint, Math.round(l.usd), l.amount])).toEqual([
      ["buy", JUP_MINT, 800, "800000000"],
      ["buy", SOL_MINT, 200, "200000000"],
    ]);
    expect(plan.usdcTargetUsd).toBe(0);
    expect(plan.positions.find((p) => p.mint === USDC_MINT)).toMatchObject({
      weight: 0.5,
      targetWeight: 0,
    });
  });

  it("sells an exited position in full and orders sells before buys", () => {
    const plan = planRebalance({
      balances: { [SOL_MINT]: sol(5.02), [JUP_MINT]: jup(1000) },
      prices,
      target: { [JUP_MINT]: 1 },
      universe,
      driftThresholdPct: 0,
    });
    // $500 SOL + $500 JUP → all JUP: sell all investable SOL, buy $500 JUP.
    expect(plan.legs).toEqual([
      expect.objectContaining({ side: "sell", mint: SOL_MINT, full: true, amount: "5000000000" }),
      expect.objectContaining({ side: "buy", mint: JUP_MINT, amount: "500000000" }),
    ]);
  });

  it("skips legs below the minimum order or the drift threshold", () => {
    const plan = planRebalance({
      balances: { [SOL_MINT]: sol(6.07), [JUP_MINT]: jup(790) },
      prices,
      target: { [SOL_MINT]: 0.6, [JUP_MINT]: 0.4 },
      universe,
      driftThresholdPct: 2,
    });
    // $605 SOL / $395 JUP of $1,000: SOL −$5 (below $10), JUP +$5.
    expect(plan.legs).toEqual([]);
    expect(plan.skipped.map((s) => [s.mint, s.reason])).toEqual([
      [SOL_MINT, "below_minimum"],
      [JUP_MINT, "below_minimum"],
    ]);

    const drifted = planRebalance({
      balances: { [SOL_MINT]: sol(6.32), [JUP_MINT]: jup(740) },
      prices,
      target: { [SOL_MINT]: 0.6, [JUP_MINT]: 0.4 },
      universe,
      driftThresholdPct: 5,
    });
    // $630 / $370: 3pp off, under the 5pp threshold though over $10.
    expect(drifted.skipped.map((s) => s.reason)).toEqual(["below_drift", "below_drift"]);
  });

  it("keeps unpriceable targets in USDC and plans nothing for an empty wallet", () => {
    const UNPRICED = "Unpriced11111111111111111111111111111111111";
    const plan = planRebalance({
      balances: { [USDC_MINT]: usdc(100) },
      prices,
      target: { [UNPRICED]: 0.5, [JUP_MINT]: 0.5 },
      universe: [UNPRICED, JUP_MINT],
      driftThresholdPct: 0,
    });
    expect(plan.usdcTargetUsd).toBeCloseTo(50, 9);
    expect(plan.skipped).toEqual([{ side: "buy", mint: UNPRICED, usd: 50, reason: "no_price" }]);
    expect(plan.legs.map((l) => [l.mint, l.usd])).toEqual([[JUP_MINT, 50]]);

    const empty = planRebalance({
      balances: {},
      prices,
      target: { [JUP_MINT]: 1 },
      universe,
      driftThresholdPct: 0,
    });
    expect(empty).toMatchObject({ totalUsd: 0, legs: [] });
  });

  it("caps a sell at the investable balance", () => {
    // Target 0.5 of a mostly-JUP wallet: SOL wants +, JUP sells 99.9%… but never more than held.
    const plan = planRebalance({
      balances: { [JUP_MINT]: jup(2000), [SOL_MINT]: sol(0.03) },
      prices: { ...prices, [JUP_MINT]: 0.5 },
      target: { [SOL_MINT]: 1 },
      universe,
      driftThresholdPct: 0,
    });
    expect(plan.legs[0]).toMatchObject({
      side: "sell",
      mint: JUP_MINT,
      amount: "2000000000",
      full: true,
    });
  });
});

describe("sizeLeg", () => {
  const buy = { side: "buy" as const, mint: JUP_MINT, usd: 300, amount: "300000000", full: false };

  it("scales buys to the USDC the sells actually produced", () => {
    // Plan: two buys, $300 + $200. Sells came in short: $450 USDC, keep $0.
    expect(
      sizeLeg(buy, {
        balances: { [USDC_MINT]: usdc(450) },
        remainingBuyUsd: 500,
        usdcTargetUsd: 0,
      }),
    ).toEqual({
      amount: "270000000", // 300 × 450/500
    });
    // Enough USDC: full planned amount.
    expect(
      sizeLeg(buy, {
        balances: { [USDC_MINT]: usdc(900) },
        remainingBuyUsd: 500,
        usdcTargetUsd: 0,
      }),
    ).toEqual({
      amount: "300000000",
    });
  });

  it("skips a buy that would fall below the minimum", () => {
    expect(
      sizeLeg(buy, {
        balances: { [USDC_MINT]: usdc(105) },
        remainingBuyUsd: 500,
        usdcTargetUsd: 100,
      }),
    ).toEqual({ skip: expect.stringContaining("Only $3.00 of USDC") });
  });

  it("sells no more than the wallet still holds, or everything for a full exit", () => {
    const sell = {
      side: "sell" as const,
      mint: SOL_MINT,
      usd: 500,
      amount: "5000000000",
      full: false,
    };
    const ctx = { remainingBuyUsd: 0, usdcTargetUsd: 0 };
    expect(sizeLeg(sell, { ...ctx, balances: { [SOL_MINT]: sol(3.02) } })).toEqual({
      amount: "3000000000",
    });
    expect(sizeLeg(sell, { ...ctx, balances: { [SOL_MINT]: sol(8.02) } })).toEqual({
      amount: "5000000000",
    });
    expect(
      sizeLeg({ ...sell, full: true }, { ...ctx, balances: { [SOL_MINT]: sol(8.02) } }),
    ).toEqual({
      amount: "8000000000",
    });
    expect(sizeLeg(sell, { ...ctx, balances: {} })).toEqual({ skip: "Nothing left to sell" });
  });
});

describe("realizedPrice", () => {
  it("is USDC per whole token for both sides", () => {
    expect(
      realizedPrice("sell", { inputAmount: "2000000000", outputAmount: "199500000" }, 9),
    ).toBeCloseTo(99.75, 9);
    expect(
      realizedPrice("buy", { inputAmount: "100000000", outputAmount: "199000000" }, 6),
    ).toBeCloseTo(0.5025, 4);
    expect(realizedPrice("buy", { inputAmount: "1", outputAmount: "0" }, 6)).toBeNull();
  });
});
