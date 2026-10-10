/** Shared shapes for the stocks screener (/markets) and stock pages. */

export type MarketCategory = "equity" | "etf" | "commodity";

export type MarketRow = {
  /** Company ticker, e.g. NVDA (the stock page is /markets/NVDA). */
  ticker: string;
  name: string;
  category: MarketCategory;
  sector: string;
  preIpo: boolean;
  /** When the token trades ("24/5", "Market hours"…). */
  hours: string;
  /** The token traded: the most liquid issuer's, e.g. NVDAx. */
  symbol: string;
  issuer: string;
  /** From the registry; the only mint a trade can use. */
  mint: string;
  decimals: number;
  /** The token whose history the charts use. */
  chartMint: string;
  icon: string | null;
  price: number | null;
  change24h: number | null;
  /** On-chain market cap (tokens on Solana × price), not the company's. */
  marketCap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  holders: number | null;
};
