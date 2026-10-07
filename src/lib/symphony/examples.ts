import { CRYPTO_ALLOWLIST, SOL_MINT, USDC_MINT } from "@/lib/assets/allowlist";

import type { Symphony } from "./types";

// Mints come only from the asset registry's curated allowlist.
const mintOf = (ticker: (typeof CRYPTO_ALLOWLIST)[number]["ticker"]): string =>
  CRYPTO_ALLOWLIST.find((asset) => asset.ticker === ticker)!.mint;
export const JUP_MINT = mintOf("JUP");
export const BONK_MINT = mintOf("BONK");
export const JTO_MINT = mintOf("JTO");
export const PYTH_MINT = mintOf("PYTH");
export const RAY_MINT = mintOf("RAY");

/** Hold SOL while it trades above its 50-day average, otherwise sit in USDC. */
export const solTrendFollower: Symphony = {
  version: 1,
  name: "SOL/USDC trend follower",
  description: "Hold SOL if SOL > SMA(50), else USDC.",
  root: {
    type: "if",
    condition: {
      left: { mint: SOL_MINT, indicator: { fn: "price" } },
      comparator: "gt",
      right: { mint: SOL_MINT, indicator: { fn: "sma", period: 50 } },
    },
    then: { type: "asset", mint: SOL_MINT },
    else: { type: "asset", mint: USDC_MINT },
  },
};

/** Equal-weight the 3 strongest Solana majors by 30-day return. */
export const solanaMomentumTop3: Symphony = {
  version: 1,
  name: "Solana momentum top 3",
  description: "Each rebalance, hold the 3 best 30-day performers, equally weighted.",
  root: {
    type: "filter",
    sortBy: { fn: "cumulativeReturn", period: 30 },
    select: { direction: "top", count: 3 },
    children: [SOL_MINT, JUP_MINT, BONK_MINT, JTO_MINT, PYTH_MINT, RAY_MINT].map((mint) => ({
      type: "asset" as const,
      mint,
    })),
  },
};

/** Static 60/40 split, rebalanced back to target. */
export const solJup6040: Symphony = {
  version: 1,
  name: "SOL/JUP 60/40",
  description: "60% SOL, 40% JUP.",
  root: {
    type: "group",
    name: "SOL/JUP 60/40",
    weight: { method: "specified", percentages: [60, 40] },
    children: [
      { type: "asset", mint: SOL_MINT },
      { type: "asset", mint: JUP_MINT },
    ],
  },
};

/** Display symbols for the mints the examples use. */
export const EXAMPLE_TOKEN_SYMBOLS: Readonly<Record<string, string>> = {
  [SOL_MINT]: "SOL",
  [USDC_MINT]: "USDC",
  [JUP_MINT]: "JUP",
  [BONK_MINT]: "BONK",
  [JTO_MINT]: "JTO",
  [PYTH_MINT]: "PYTH",
  [RAY_MINT]: "RAY",
};

export const EXAMPLE_SYMPHONIES: readonly Symphony[] = [
  solTrendFollower,
  solanaMomentumTop3,
  solJup6040,
];
