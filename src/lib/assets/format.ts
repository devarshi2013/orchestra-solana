import type { Asset } from "./registry";

/** USD price with sensible precision for anything from BTC to BONK. */
export function formatPrice(usd: number | null | undefined): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return "—";
  if (usd >= 1)
    return usd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  return `$${usd.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "")}`;
}

/** "+1.29%" from Jupiter's percent (1.29 means +1.29%). */
export function formatChange(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "—";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

/** Thin by registry data alone (before a test quote): little pool liquidity and little volume. */
export const looksThin = (asset: Pick<Asset, "liquidityUsd" | "volume24hUsd">) =>
  (asset.liquidityUsd ?? 0) < 100_000 && (asset.volume24hUsd ?? 0) < 250_000;

/** The label shown wherever an asset is picked: token symbol plus issuer for stocks. */
export const assetLabel = (asset: Pick<Asset, "symbol" | "kind" | "ticker">) => asset.symbol;
