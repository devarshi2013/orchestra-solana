import type { TokenInfo } from "@/lib/tokens";

import type { Asset } from "./registry";

/** A registry asset in the TokenInfo shape the token UI components use. */
export const assetToToken = (asset: Asset): TokenInfo => ({
  mint: asset.mint,
  symbol: asset.symbol,
  name: asset.name,
  decimals: asset.decimals,
  icon: asset.icon,
  isVerified: true,
  isSus: false,
  liquidity: asset.liquidityUsd,
});
