import type { Allocation } from "@/lib/symphony/types";
import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

/**
 * Rebalance planning: wallet balances + spot prices + the symphony's target
 * weights → swap legs, all netted through USDC (sell X → USDC, USDC → Y).
 * Pure; amounts are integer base units as decimal strings, values in USD.
 */

/**
 * Smallest leg we send. Jupiter documents no hard minimum except gasless
 * orders (~$10 when the wallet holds < 0.01 SOL); below that, fees and price
 * impact eat the trade anyway. See docs/invest.md.
 */
export const MIN_LEG_USD = 10;
/** SOL left in the wallet for network fees and token-account rent; never sold. */
export const SOL_FEE_RESERVE = 0.02;
export const USDC_DECIMALS = 6;

export type Balance = { amount: string; decimals: number };

export type Position = {
  mint: string;
  /** Investable whole-token units (SOL net of the fee reserve). */
  units: number;
  usd: number;
  weight: number;
  targetWeight: number;
};

export type PlannedLeg = {
  side: "sell" | "buy";
  /** The non-USDC token. */
  mint: string;
  usd: number;
  /** Input amount in base units: the token for a sell, USDC for a buy. */
  amount: string;
  /** Sell the whole investable position (target weight 0), leaving no dust. */
  full: boolean;
  drift: number;
};

export type SkipReason = "below_minimum" | "below_drift" | "no_price";
export type SkippedLeg = { side: "sell" | "buy"; mint: string; usd: number; reason: SkipReason };

export type RebalancePlan = {
  totalUsd: number;
  positions: Position[];
  /** Sells first, then buys; each group largest first. */
  legs: PlannedLeg[];
  skipped: SkippedLeg[];
  /** USDC the plan intends to keep (its target weight plus unpriceable targets). */
  usdcTargetUsd: number;
};

export type PlanInput = {
  balances: Readonly<Record<string, Balance>>;
  /** USD per whole token. USDC is always valued at $1. */
  prices: Readonly<Record<string, number>>;
  target: Allocation;
  /** Mints that make up the portfolio: the symphony's mints and USDC. */
  universe: readonly string[];
  /** Skip legs whose weight is within this many percentage points of target. */
  driftThresholdPct: number;
  minLegUsd?: number;
  solReserve?: number;
};

export function toUnits(amount: string | bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

/** Whole-token units → base units, rounded down so we never ask for more than we have. */
export function toBaseUnits(units: number, decimals: number): bigint {
  if (!(units > 0)) return 0n;
  const [whole = "0", fraction = ""] = units.toFixed(decimals).split(".");
  const base = BigInt(whole + fraction.padEnd(decimals, "0").slice(0, decimals));
  // toFixed rounds half up; step back one unit if that overshot.
  return Number(base) / 10 ** decimals > units ? base - 1n : base;
}

/** Base units the wallet can trade: everything, except SOL keeps its fee reserve. */
export function investableBase(
  mint: string,
  balance: Balance | undefined,
  solReserve = SOL_FEE_RESERVE,
): bigint {
  if (!balance) return 0n;
  const amount = BigInt(balance.amount);
  if (mint !== SOL_MINT) return amount;
  const reserve = toBaseUnits(solReserve, balance.decimals);
  return amount > reserve ? amount - reserve : 0n;
}

export function planRebalance(input: PlanInput): RebalancePlan {
  const minLegUsd = input.minLegUsd ?? MIN_LEG_USD;
  const priceOf = (mint: string) => (mint === USDC_MINT ? 1 : input.prices[mint]);
  const universe = [...new Set([...input.universe, USDC_MINT])];

  const holdings = universe.flatMap((mint) => {
    const balance = input.balances[mint];
    const price = priceOf(mint);
    if (!balance || price === undefined) return [];
    const base = investableBase(mint, balance, input.solReserve);
    const units = toUnits(base, balance.decimals);
    return [{ mint, base, decimals: balance.decimals, units, usd: units * price, price }];
  });
  const totalUsd = holdings.reduce((sum, h) => sum + h.usd, 0);

  // Target weight of mints we can't price can't be bought: it stays in USDC.
  const skipped: SkippedLeg[] = [];
  const target: Allocation = {};
  for (const [mint, weight] of Object.entries(input.target)) {
    const key = priceOf(mint) === undefined ? USDC_MINT : mint;
    if (key !== mint)
      skipped.push({ side: "buy", mint, usd: weight * totalUsd, reason: "no_price" });
    target[key] = (target[key] ?? 0) + weight;
  }

  const positions: Position[] = [
    ...new Set([...holdings.map((h) => h.mint), ...Object.keys(target)]),
  ]
    .map((mint) => {
      const held = holdings.find((h) => h.mint === mint);
      return {
        mint,
        units: held?.units ?? 0,
        usd: held?.usd ?? 0,
        weight: totalUsd > 0 ? (held?.usd ?? 0) / totalUsd : 0,
        targetWeight: target[mint] ?? 0,
      };
    })
    .sort((a, b) => b.targetWeight - a.targetWeight || b.usd - a.usd);

  const legs: PlannedLeg[] = [];
  if (totalUsd > 0) {
    for (const position of positions) {
      if (position.mint === USDC_MINT) continue;
      const held = holdings.find((h) => h.mint === position.mint);
      const delta = position.targetWeight * totalUsd - position.usd;
      const side = delta < 0 ? "sell" : "buy";
      const usd = Math.abs(delta);
      const drift = Math.abs(position.targetWeight - position.weight) * 100;
      if (usd === 0) continue;
      if (usd < minLegUsd) {
        skipped.push({ side, mint: position.mint, usd, reason: "below_minimum" });
        continue;
      }
      if (drift < input.driftThresholdPct) {
        skipped.push({ side, mint: position.mint, usd, reason: "below_drift" });
        continue;
      }
      if (side === "sell") {
        const full = position.targetWeight === 0;
        const wanted = toBaseUnits(usd / held!.price, held!.decimals);
        const amount = full || wanted > held!.base ? held!.base : wanted;
        legs.push({ side, mint: position.mint, usd, amount: amount.toString(), full, drift });
      } else {
        const amount = toBaseUnits(usd, USDC_DECIMALS);
        legs.push({
          side,
          mint: position.mint,
          usd,
          amount: amount.toString(),
          full: false,
          drift,
        });
      }
    }
  }
  legs.sort((a, b) => (a.side === b.side ? b.usd - a.usd : a.side === "sell" ? -1 : 1));

  return { totalUsd, positions, legs, skipped, usdcTargetUsd: (target[USDC_MINT] ?? 0) * totalUsd };
}

export type LegSizing = { amount: string } | { skip: string };

/**
 * Sizes a leg right before quoting it, from balances re-read after earlier
 * legs. Sells never exceed what's held; buys share the USDC the sells actually
 * produced (above the USDC the plan keeps), pro rata across remaining buys.
 */
export function sizeLeg(
  leg: Pick<PlannedLeg, "side" | "mint" | "usd" | "amount" | "full">,
  ctx: {
    balances: Readonly<Record<string, Balance>>;
    /** Planned USD of this and every later buy that hasn't run yet. */
    remainingBuyUsd: number;
    usdcTargetUsd: number;
    minLegUsd?: number;
    solReserve?: number;
  },
): LegSizing {
  const minLegUsd = ctx.minLegUsd ?? MIN_LEG_USD;
  if (leg.side === "sell") {
    const available = investableBase(leg.mint, ctx.balances[leg.mint], ctx.solReserve);
    const amount = leg.full
      ? available
      : BigInt(leg.amount) < available
        ? BigInt(leg.amount)
        : available;
    return amount > 0n ? { amount: amount.toString() } : { skip: "Nothing left to sell" };
  }
  const usdc = toUnits(ctx.balances[USDC_MINT]?.amount ?? "0", USDC_DECIMALS);
  const spendable = Math.max(0, usdc - ctx.usdcTargetUsd);
  const scale = Math.min(1, spendable / ctx.remainingBuyUsd);
  const usd = leg.usd * scale;
  if (usd < minLegUsd) {
    return {
      skip: `Only $${usd.toFixed(2)} of USDC available for this buy (minimum $${minLegUsd})`,
    };
  }
  return { amount: toBaseUnits(usd, USDC_DECIMALS).toString() };
}

/** USD per whole token actually paid or received, from Jupiter's totals. */
export function realizedPrice(
  side: "sell" | "buy",
  totals: { inputAmount: string; outputAmount: string },
  tokenDecimals: number,
): number | null {
  const tokenAmount = toUnits(
    side === "sell" ? totals.inputAmount : totals.outputAmount,
    tokenDecimals,
  );
  const usdc = toUnits(side === "sell" ? totals.outputAmount : totals.inputAmount, USDC_DECIMALS);
  return tokenAmount > 0 ? usdc / tokenAmount : null;
}
