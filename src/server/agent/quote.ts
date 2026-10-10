import "server-only";

import type { ItemQuote } from "@/lib/assistant/review";
import { getWalletBalances, quoteBestIssuer } from "@/lib/stocks/tools";
import { ISSUER_NAMES } from "@/lib/stocks/types";

/**
 * A fresh quote for one plan item from `wallet`: the issuers' tokens for the
 * company quoted one at a time (paced), stopping at the first that works.
 * Returns that token's registry details, including the mint the buy will use;
 * the mint comes from the registry, never from the model. Never builds
 * anything the browser could sign.
 */
export async function quoteItem(
  wallet: string,
  input: { symbol: string; usdcAmount: number },
): Promise<ItemQuote> {
  // No server-side 429 retries here: the browser retries, showing "Retrying…".
  const result = await quoteBestIssuer(input.symbol, input.usdcAmount, wallet, {
    retryRateLimit: false,
  });
  if (!result.data)
    return {
      symbol: input.symbol,
      quote: null,
      reason: result.reason,
      errorKind: result.kind ?? null,
      token: null,
    };
  const { entry, quote } = result.data;
  return {
    symbol: input.symbol,
    quote,
    reason: null,
    errorKind: null,
    token: {
      symbol: entry.symbol,
      issuer: ISSUER_NAMES[entry.issuer],
      mint: entry.mint,
      decimals: entry.decimals,
      liquidityTier: entry.liquidityTier,
      hours: entry.hours,
      preIpo: entry.preIpo,
    },
  };
}

/** USDC and SOL for the pre-flight checks. */
export async function walletFunds(wallet: string) {
  const result = await getWalletBalances(wallet);
  return result.data
    ? { usdc: result.data.usdc, sol: result.data.sol, reason: null }
    : { usdc: null, sol: null, reason: result.reason };
}
