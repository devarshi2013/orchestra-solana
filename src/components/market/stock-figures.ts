import { ISSUERS } from "@/lib/stocks/issuers";
import type { Stock, StockToken } from "@/lib/stocks/types";

/** The sum of a figure over a company's tokens; null when none of them reports it. */
function total(tokens: readonly StockToken[], pick: (t: StockToken) => number | null) {
  const known = tokens.map(pick).filter((v): v is number => v != null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

/**
 * What a company row shows: price and 24h change of its most liquid token
 * (the one a trade would most likely use), volume, liquidity and holders summed
 * over every issuer's token.
 */
export function stockFigures({ tokens }: Stock) {
  const top = tokens[0]!;
  return {
    price: top.price,
    change24h: top.change24h,
    volume24h: total(tokens, (t) => t.volume24h),
    liquidity: total(tokens, (t) => t.liquidity),
    holders: total(tokens, (t) => t.holders),
    marketCap: total(tokens, (t) => t.marketCap),
  };
}

export type StockFigures = ReturnType<typeof stockFigures>;

/** "xStocks", "Ondo"… or "Other" for a token whose issuer we don't group. */
export const issuerLabel = (issuer: StockToken["issuer"]) =>
  issuer ? ISSUERS[issuer].label : "Other";

/** The newest token's first appearance on Jupiter, for "Latest added". */
export const newestToken = ({ tokens }: Stock) =>
  tokens.reduce(
    (max, t) => (t.createdAt && t.createdAt > (max ?? "") ? t.createdAt : max),
    null as string | null,
  );
