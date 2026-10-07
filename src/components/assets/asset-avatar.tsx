"use client";

import { TokenAvatar } from "@/components/swap/token-avatar";
import type { Asset } from "@/lib/assets/registry";

export function AssetAvatar({ asset, className }: { asset: Asset; className?: string }) {
  return (
    <TokenAvatar
      token={{
        mint: asset.mint,
        symbol: asset.symbol,
        name: asset.name,
        decimals: asset.decimals,
        icon: asset.icon,
        isVerified: true,
        isSus: false,
        liquidity: asset.liquidityUsd,
      }}
      className={className}
    />
  );
}
