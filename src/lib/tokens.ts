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
  };
}

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
].map((token) => ({ ...token, icon: null, isVerified: true, isSus: false }));
