import type { Symphony } from "@/lib/symphony/types";

/**
 * "Keep this balanced automatically": the bought items of an assistant plan as
 * a symphony holding them at the plan's weights. Weights follow the planned
 * USDC amounts of the items that were actually bought, rounded to hundredths
 * of a percent so they sum to exactly 100.
 */

type BoughtItem = { symbol: string; usdcAmount: number; status: string };

export function keepBalancedWeights(
  items: readonly BoughtItem[],
): { symbol: string; percent: number }[] {
  const bought = items.filter((i) => i.status === "succeeded" && i.usdcAmount > 0);
  const total = bought.reduce((sum, i) => sum + i.usdcAmount, 0);
  if (bought.length === 0 || total <= 0) return [];
  // Largest remainder over 10,000 hundredths of a percent.
  const exact = bought.map((i) => (i.usdcAmount / total) * 10_000);
  const units = exact.map(Math.floor);
  let left = 10_000 - units.reduce((sum, u) => sum + u, 0);
  const order = exact
    .map((x, i) => ({ i, remainder: x - Math.floor(x) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) {
    if (left-- <= 0) break;
    units[i]!++;
  }
  return bought.map((item, i) => ({ symbol: item.symbol, percent: units[i]! / 100 }));
}

export function keepBalancedSymphony(
  name: string,
  items: readonly (BoughtItem & { mint: string })[],
): Symphony | null {
  const weights = keepBalancedWeights(items);
  if (weights.length === 0) return null;
  const mintOf = new Map(items.map((i) => [i.symbol, i.mint]));
  return {
    version: 1,
    name,
    description: "Saved from an assistant plan: held at the plan's weights.",
    root: {
      type: "group",
      name: "Plan weights",
      weight: { method: "specified", percentages: weights.map((w) => w.percent) },
      children: weights.map((w) => ({ type: "asset", mint: mintOf.get(w.symbol)! })),
    },
  };
}
