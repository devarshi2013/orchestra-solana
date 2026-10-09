import { z } from "zod";

import type { MintInformation } from "@/lib/jupiter/schemas";

export const tokenInfoSchema = z.object({
  mint: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number().int().nonnegative(),
  icon: z.string().nullable(),
  isVerified: z.boolean(),
  /** Flagged by Jupiter's audit (`audit.isSus`). */
  isSus: z.boolean(),
  /** USD liquidity, when known. */
  liquidity: z.number().nullable(),
});

export type TokenInfo = z.infer<typeof tokenInfoSchema>;

export function toTokenInfo(mint: MintInformation): TokenInfo {
  return {
    mint: mint.id,
    symbol: mint.symbol,
    name: mint.name,
    decimals: mint.decimals,
    icon: mint.icon ?? null,
    isVerified: mint.isVerified === true,
    isSus: mint.audit?.isSus === true,
    liquidity: mint.liquidity ?? null,
  };
}

/** Wrapped SOL and USDC on Solana mainnet: what plans spend and pay fees with. Stock mints come only from src/lib/stocks. */
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Quick picks shown before the user searches. Mainnet mints. */
export const DEFAULT_TOKENS: readonly TokenInfo[] = [
  { mint: SOL_MINT, symbol: "SOL", name: "Wrapped SOL", decimals: 9 },
  { mint: USDC_MINT, symbol: "USDC", name: "USD Coin", decimals: 6 },
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "USDT",
    decimals: 6,
  },
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
  },
].map((token) => ({ ...token, icon: null, isVerified: true, isSus: false, liquidity: null }));

/** Below this USD liquidity, trades move the price and indicators get noisy. */
export const LOW_LIQUIDITY_USD = 50_000;

export function isLowLiquidity(token: Pick<TokenInfo, "liquidity">): boolean {
  return token.liquidity !== null && token.liquidity < LOW_LIQUIDITY_USD;
}

/**
 * Verified tokens first, then an exact (case-insensitive) symbol match for
 * `query`, otherwise the API's relevance order.
 */
export function rankTokens(tokens: readonly TokenInfo[], query = ""): TokenInfo[] {
  const wanted = query.trim().toLowerCase();
  const exact = (token: TokenInfo) =>
    Number(wanted !== "" && token.symbol.toLowerCase() === wanted);
  return tokens
    .map((token, index) => ({ token, index }))
    .sort(
      (a, b) =>
        Number(b.token.isVerified) - Number(a.token.isVerified) ||
        exact(b.token) - exact(a.token) ||
        a.index - b.index,
    )
    .map(({ token }) => token);
}
