import type { CryptoCategory } from "./registry";

/**
 * Hand-curated crypto, kept even when below the discovery thresholds (they
 * still must pass verification). Mints copied from Jupiter's verified token
 * list (strict tag) on 2026-10-07, never typed from memory.
 */
export const CRYPTO_ALLOWLIST = [
  {
    ticker: "SOL",
    name: "Solana",
    category: "Major",
    mint: "So11111111111111111111111111111111111111112",
  },
  {
    ticker: "JUP",
    name: "Jupiter",
    category: "DeFi",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  },
  {
    ticker: "BONK",
    name: "Bonk",
    category: "Meme",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  },
  {
    ticker: "JTO",
    name: "Jito",
    category: "DeFi",
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  },
  {
    ticker: "PYTH",
    name: "Pyth Network",
    category: "Infrastructure",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  },
  {
    ticker: "RAY",
    name: "Raydium",
    category: "DeFi",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  },
  {
    ticker: "WIF",
    name: "dogwifhat",
    category: "Meme",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  },
] as const satisfies readonly {
  ticker: string;
  name: string;
  category: CryptoCategory;
  mint: string;
}[];

/**
 * The cash asset (what plans spend). Listed for balances and quotes, but never offered as an
 * investment pick.
 */
export const CASH_ASSET = {
  ticker: "USDC",
  name: "USD Coin",
  category: "Cash",
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

/** Mints the app's own code refers to. */
export const SOL_MINT: string = CRYPTO_ALLOWLIST[0].mint;
export const USDC_MINT: string = CASH_ASSET.mint;
