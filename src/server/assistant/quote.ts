import "server-only";

import { getSwapQuote, getWalletBalances, resolveAsset } from "@/lib/assets/tools";
import type { ItemQuote } from "@/lib/assistant/review";
import { getRegistry } from "@/server/assets/registry";
import { paced } from "@/server/jupiter/pace";

/**
 * A fresh quote for one plan item from `owner`'s wallet: the same live Jupiter
 * quote the assistant used, plus the registry's pool liquidity and trading
 * hours for the item's warnings. Paced, so a plan's quotes stay inside the
 * Jupiter plan's rate limit. Never builds anything the browser could sign.
 */
export async function quoteItem(
  owner: string,
  input: { symbol: string; usdcAmount: number },
): Promise<ItemQuote> {
  const registry = await getRegistry();
  const found = resolveAsset([...registry.stocks, ...registry.crypto], input.symbol);
  const asset = "asset" in found ? found.asset : null;
  const result = await paced(() =>
    getSwapQuote({ ticker: input.symbol, usdcAmount: input.usdcAmount, wallet: owner }),
  );
  return {
    symbol: input.symbol,
    quote: result.data,
    reason: result.reason,
    liquidityUsd: asset?.liquidityUsd ?? null,
    hours: asset?.hours ?? null,
  };
}

/** USDC and SOL for the pre-flight checks. */
export async function walletFunds(owner: string) {
  const result = await getWalletBalances(owner);
  return result.data
    ? { usdc: result.data.usdc, sol: result.data.sol, reason: null }
    : { usdc: null, sol: null, reason: result.reason };
}
