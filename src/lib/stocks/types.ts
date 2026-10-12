import type { IssuerId } from "./issuers";

/**
 * One tokenized stock token, as Jupiter reports it: verified by Jupiter and
 * tagged `stocks`. Market fields are null when Jupiter has no figure.
 */
export type StockToken = {
  mint: string;
  /** The token's own symbol, e.g. NVDAx, NVDAon, MU. */
  symbol: string;
  name: string;
  decimals: number;
  icon: string | null;
  /** Jupiter's issuer tag, when it's one we know how to group. */
  issuer: IssuerId | null;
  /** Every tag Jupiter puts on the token (issuer, `stocks`, `verified`…). */
  tags: string[];
  price: number | null;
  /** 24h price change, percent. */
  change24h: number | null;
  liquidity: number | null;
  volume24h: number | null;
  /** On-chain market cap (tokens on Solana × price), not the company's. */
  marketCap: number | null;
  holders: number | null;
  /** When Jupiter first saw the token (ISO date). */
  createdAt: string | null;
};

/** A company (or fund, or product) with every issuer's token for it, most liquid first. */
export type Stock = {
  /** The company ticker shared by its issuers' tokens (NVDA), or the token's own symbol. */
  ticker: string;
  name: string;
  icon: string | null;
  tokens: StockToken[];
};
