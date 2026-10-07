import type { Asset } from "./registry";

/**
 * A ticker or token symbol → one registry asset. Token symbols are exact
 * (AAPLx); a ticker shared by two issuers (AAPL) is ambiguous.
 */
export function resolveAsset(
  assets: readonly Asset[],
  ticker: string,
): { asset: Asset } | { reason: string } {
  const wanted = ticker.trim().replace(/^\$/, "").toUpperCase();
  const norm = (s: string) => s.replace(/^\$/, "").toUpperCase();
  const bySymbol = assets.filter((a) => norm(a.symbol) === wanted);
  if (bySymbol.length === 1) return { asset: bySymbol[0]! };
  const byTicker = assets.filter((a) => norm(a.ticker) === wanted);
  if (byTicker.length === 1) return { asset: byTicker[0]! };
  if (byTicker.length > 1) {
    return {
      reason: `"${ticker}" matches ${byTicker.map((a) => a.symbol).join(" and ")}; use the token symbol`,
    };
  }
  return { reason: `"${ticker}" isn't in Orchestra's asset registry` };
}
