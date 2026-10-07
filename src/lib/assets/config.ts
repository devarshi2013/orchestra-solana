/**
 * Every threshold that decides what Orchestra lists as investable, in one
 * place. Amounts in USD. See docs/tokenized-stocks.md and docs/assets.md.
 */

export type CryptoFilters = {
  requireVerified: boolean;
  minLiquidityUsd: number;
  minVolume24hUsd: number;
  minAgeDays: number;
  excludeTags: readonly string[];
  stablecoinSymbols: readonly string[];
  maxAssets: number;
};

export type StockFilters = {
  requireVerified: boolean;
  minLiquidityUsd: number;
  minVolume24hUsd: number;
  maxAssets: number;
};

/** Crypto picked from Jupiter's verified list (`/tokens/v2/tag?query=verified`). */
export const CRYPTO_FILTERS: CryptoFilters = {
  requireVerified: true,
  minLiquidityUsd: 1_000_000,
  minVolume24hUsd: 500_000,
  /** Days since the token's first pool. */
  minAgeDays: 90,
  /** Jupiter tags that disqualify a token from the crypto list. */
  excludeTags: [
    "stable", // stablecoins are cash, not investments
    "yb", // yield-bearing stablecoin wrappers
    "jup-lend-earn", // lending receipts
    "rwa",
    "stocks",
    "xstocks",
    "ondo",
    "prestocks",
    "equities",
    "backpack", // Backpack-issued tokens are never listed
  ],
  /** Belt and braces: symbols treated as stablecoins even if untagged. */
  stablecoinSymbols: [
    "USDC",
    "USDT",
    "PYUSD",
    "USDS",
    "USDe",
    "USD1",
    "FDUSD",
    "USDG",
    "DAI",
    "EURC",
    "USDH",
    "AUSD",
  ],
  maxAssets: 60,
};

/**
 * Tokenized stocks from the issuers' official lists. Ondo trades mostly
 * through RFQ market makers, so thin pool liquidity is common: a stock
 * qualifies on liquidity OR 24h volume, and the /assets test quote is the
 * real check.
 */
export const STOCK_FILTERS: StockFilters = {
  requireVerified: true,
  minLiquidityUsd: 100_000,
  minVolume24hUsd: 250_000,
  maxAssets: 80,
};

/** The /assets liquidity check: quote this much USDC into the asset. */
export const TEST_QUOTE_USD = 1_000;
/** Warn when that quote's price impact exceeds this (percent). */
export const MAX_TEST_QUOTE_IMPACT_PCT = 1;

/** How often the server rebuilds the verified registry. */
export const REGISTRY_REFRESH_MS = 6 * 60 * 60 * 1000;
