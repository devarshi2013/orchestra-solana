import "server-only";

import type { ItemQuote } from "@/lib/assistant/review";
import { ISSUERS } from "@/lib/stocks/issuers";
import { getWalletBalances, quoteToken } from "@/lib/stocks/tools";

/**
 * A fresh quote for one plan item (a token symbol) from `wallet`, with that
 * token's details, including the mint the buy will use. The mint comes from
 * the live stock universe, never from the model. Never builds anything the
 * browser could sign.
 */
export async function quoteItem(
  wallet: string,
  input: { symbol: string; usdcAmount: number },
): Promise<ItemQuote> {
  const result = await quoteToken(input.symbol, input.usdcAmount, wallet);
  if (!result.data)
    return {
      symbol: input.symbol,
      quote: null,
      reason: result.reason,
      errorKind: result.kind ?? null,
      token: null,
    };
  const { token, quote } = result.data;
  return {
    symbol: input.symbol,
    quote,
    reason: null,
    errorKind: null,
    token: {
      symbol: token.symbol,
      issuer: token.issuer ? ISSUERS[token.issuer].label : null,
      mint: token.mint,
      decimals: token.decimals,
    },
  };
}

/** USDC and SOL for the pre-flight checks, or the reason they couldn't be read. */
export async function walletFunds(wallet: string) {
  const { data, reason } = await getWalletBalances(wallet);
  return data
    ? { usdc: data.usdc, sol: data.sol, reason: null }
    : { usdc: null, sol: null, reason };
}
