import type { MintInformation } from "@/lib/jupiter/schemas";

import { isIssuer, ISSUERS } from "./issuers";
import type { Stock, StockToken } from "./types";

/** Jupiter's verified, non-suspicious tokens tagged `stocks` are the stock universe. */
export const isStockToken = (mint: MintInformation) =>
  mint.isVerified === true && mint.audit?.isSus !== true && (mint.tags ?? []).includes("stocks");

export function toStockToken(mint: MintInformation): StockToken {
  const tags = mint.tags ?? [];
  const stats = mint.stats24h;
  const volume =
    stats?.buyVolume == null || stats.sellVolume == null
      ? null
      : stats.buyVolume + stats.sellVolume;
  return {
    mint: mint.id,
    symbol: mint.symbol,
    name: mint.name,
    decimals: mint.decimals,
    icon: mint.icon ?? null,
    issuer: tags.find(isIssuer) ?? null,
    tags,
    price: mint.usdPrice ?? null,
    change24h: stats?.priceChange ?? null,
    liquidity: mint.liquidity ?? null,
    volume24h: volume,
    marketCap: mint.mcap ?? null,
    holders: mint.holderCount ?? null,
    createdAt: mint.createdAt ?? null,
  };
}

/** The company ticker and name a token's issuer encodes in it (NVDAx → NVDA, "NVIDIA"). */
function company({ issuer, symbol, name }: StockToken) {
  if (!issuer) return { ticker: symbol, name };
  const rule = ISSUERS[issuer];
  const ticker = rule.ticker.exec(symbol)?.[1];
  return ticker ? { ticker, name: name.replace(rule.name, "") } : { ticker: symbol, name };
}

const byLiquidity = (a: StockToken, b: StockToken) => (b.liquidity ?? -1) - (a.liquidity ?? -1);

/** Tokens grouped by company ticker; each group and the list are most liquid first. */
export function groupStocks(tokens: readonly StockToken[]): Stock[] {
  const groups = new Map<string, StockToken[]>();
  for (const token of tokens) {
    const { ticker } = company(token);
    groups.set(ticker, [...(groups.get(ticker) ?? []), token]);
  }
  return [...groups]
    .map(([ticker, group]) => {
      const sorted = [...group].sort(byLiquidity);
      const top = sorted[0]!;
      return { ticker, name: company(top).name, icon: top.icon, tokens: sorted };
    })
    .sort((a, b) => byLiquidity(a.tokens[0]!, b.tokens[0]!));
}

/** Upper-cased, without a leading `$`, as tickers and symbols are compared. */
export const normalizeName = (name: string) => name.trim().replace(/^\$/, "").toUpperCase();

export type StockIndex = {
  stocks: Stock[];
  /** Company ticker (NVDA) or any of its tokens' symbols (NVDAx) → company. */
  byName: Map<string, Stock>;
  /** Token symbol (NVDAx, MU) → that token and its company. */
  bySymbol: Map<string, { stock: Stock; token: StockToken }>;
  byMint: Map<string, { stock: Stock; token: StockToken }>;
};

/** Lookups over grouped stocks; the first listed wins when two symbols collide. */
export function indexStocks(stocks: Stock[]): StockIndex {
  const byName = new Map<string, Stock>();
  const bySymbol = new Map<string, { stock: Stock; token: StockToken }>();
  const byMint = new Map<string, { stock: Stock; token: StockToken }>();
  const add = <V>(map: Map<string, V>, key: string, value: V) => {
    if (!map.has(key)) map.set(key, value);
  };
  for (const stock of stocks) {
    add(byName, normalizeName(stock.ticker), stock);
    for (const token of stock.tokens) {
      add(byName, normalizeName(token.symbol), stock);
      add(bySymbol, normalizeName(token.symbol), { stock, token });
      byMint.set(token.mint, { stock, token });
    }
  }
  return { stocks, byName, bySymbol, byMint };
}
