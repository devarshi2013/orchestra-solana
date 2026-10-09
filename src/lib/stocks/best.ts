import { LIQUIDITY_TIERS, type LiquidityTier } from "./types";

/**
 * Same company, several issuers: quote every issuer's token for the same USDC
 * and buy the one with the lowest total cost. Price impact (against that
 * token's own market) plus Jupiter's fee is comparable across issuers; token
 * amounts aren't (each issuer's token can track a different number of shares).
 */
export type CandidateQuote = {
  symbol: string;
  liquidityTier: LiquidityTier;
  /** Absolute price impact, percent; null when Jupiter didn't say. */
  priceImpactPct: number | null;
  feeBps: number | null;
  /** False when there's no route, or Jupiter can't build the swap for this wallet. */
  buildable: boolean;
};

/** Price impact plus fee, percent. Unknown impact can't be compared, so it ranks last. */
export function totalCostPct(q: Pick<CandidateQuote, "priceImpactPct" | "feeBps">): number {
  if (q.priceImpactPct === null) return Number.POSITIVE_INFINITY;
  return Math.abs(q.priceImpactPct) + (q.feeBps ?? 0) / 100;
}

/** Index of the best buildable quote (lowest total cost; ties go to the more liquid tier), or -1. */
export function pickBest(quotes: readonly CandidateQuote[]): number {
  let best = -1;
  for (const [i, q] of quotes.entries()) {
    if (!q.buildable) continue;
    if (best === -1) {
      best = i;
      continue;
    }
    const current = quotes[best]!;
    const diff = totalCostPct(q) - totalCostPct(current);
    if (
      diff < -1e-9 ||
      (Math.abs(diff) <= 1e-9 &&
        LIQUIDITY_TIERS.indexOf(q.liquidityTier) < LIQUIDITY_TIERS.indexOf(current.liquidityTier))
    ) {
      best = i;
    }
  }
  return best;
}
