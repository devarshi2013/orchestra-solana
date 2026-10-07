/** Pure maths over [unix ms, USD price] series (oldest first). Never extrapolates. */

const DAY_MS = 86_400_000;

export type PricePoint = readonly [number, number];

/**
 * Percent change from the last price at or before `days` ago to the latest
 * price. null when the series doesn't reach back that far.
 */
export function returnOver(points: readonly PricePoint[], days: number): number | null {
  if (points.length < 2) return null;
  const [latestTime, latest] = points[points.length - 1]!;
  const target = latestTime - days * DAY_MS;
  // Daily points can land up to a few hours after midnight; allow half a day of slack.
  let base: PricePoint | undefined;
  for (const point of points) {
    if (point[0] <= target + DAY_MS / 2) base = point;
    else break;
  }
  if (!base || base[1] <= 0) return null;
  return (latest / base[1] - 1) * 100;
}

/**
 * Annualized volatility in percent: the sample standard deviation of the last
 * `window` daily returns × √365. null without `window + 1` prices.
 */
export function annualizedVolatility(points: readonly PricePoint[], window = 30): number | null {
  if (points.length < window + 1) return null;
  const prices = points.slice(points.length - window - 1).map((p) => p[1]);
  const returns = prices.slice(1).map((price, i) => price / prices[i]! - 1);
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}
