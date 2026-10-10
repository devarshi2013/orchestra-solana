/** Shared shapes for the stocks screener (/markets) and stock pages. */

export type MarketCategory = "equity" | "etf" | "commodity" | "crypto";

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
  /** The token whose history the charts use (xStocks when there is one: it trades around the clock). */
  chartMint: string;
  chartSymbol: string;
  chartDecimals: number;
  icon: string | null;
  price: number | null;
  change24h: number | null;
  /** On-chain market cap (tokens on Solana × price), not the company's. */
  marketCap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  holders: number | null;
};

/** Counts computed from the registry and Jupiter for the home page's stats bar. */
export type MarketTotals = {
  /** Companies in the verified registry. */
  stocks: number;
  /** Tokens (a company can have several issuers' tokens). */
  tokens: number;
  sectors: number;
  issuers: number;
  /** Sum of Jupiter's 24h volume over the listed stock tokens that report one; null when none do. */
  volume24h: number | null;
  /** How many tokens that sum covers. */
  volumeTokens: number;
  /** How many tokens trade on each schedule ("24/5", "24/7", "Market hours"), from the registry. */
  hours: Record<string, number>;
};

/** Data for the investor tiles that needs a fundamentals source; each part is null without one. */
export type InvestorExtras = {
  /** Token price against the real stock's last price, for a few popular stocks. */
  gaps:
    | { ticker: string; symbol: string; tokenPrice: number; stockPrice: number; gapPct: number }[]
    | null;
  /** US dollars per Australian dollar. */
  audUsd: number | null;
  asOf: string;
};

/** Recent Solana throughput (GET /api/network). */
export type NetworkStats = { tps: number[]; latest: number; asOf: string };

/** Everything the home page's live sections start from (GET /api/markets/overview). */
export type MarketOverview = {
  rows: MarketRow[];
  crypto: MarketRow[];
  totals: MarketTotals;
  /** When the registry was last verified against the issuers' lists (ISO date). */
  verifiedAt: string;
  /** When this data was read from Jupiter (ISO date). */
  asOf: string;
};

/** A real Jupiter /order quote (no taker, so nothing can be signed), for the home page's example. */
export type ExampleQuote = {
  ticker: string;
  symbol: string;
  usdcIn: number;
  tokensOut: number;
  priceImpactPct: number | null;
  feeBps: number | null;
  /** The venues Jupiter routed through, exactly as the quote returned them (empty when it lists none). */
  route: { label: string; percent: number }[];
  /** Which Jupiter router priced it (e.g. "metis", "jupiterz"). */
  router: string;
  asOf: string;
};

/** One row of the home page's "top 3 tech" comparison. */
export type ResearchRow = {
  ticker: string;
  name: string;
  icon: string | null;
  /** The market cap the ranking uses (see `basis`). */
  marketCap: number;
  /** Percent; null when there's no fundamentals source. */
  return1y: number | null;
  pe: number | null;
  /** USD liquidity of the token on Solana (Jupiter); null when unknown. */
  liquidity: number | null;
};

export type ResearchTop = {
  rows: ResearchRow[];
  /** "company": the real companies' market caps; "on-chain": tokens on Solana × price. */
  basis: "company" | "on-chain";
  asOf: string;
};
