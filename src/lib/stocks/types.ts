/**
 * The stock registry: every tokenized company stock and ETF that can be bought
 * through Jupiter on Solana, from official issuer lists only
 * (scripts/sync-stocks.ts → registry.generated.json). Plain types, no imports,
 * so the sync script can run them with Node's type stripping.
 */

export type Issuer = "xstocks" | "ondo" | "prestocks";

export const ISSUER_NAMES: Record<Issuer, string> = {
  xstocks: "xStocks (Backed)",
  ondo: "Ondo Global Markets",
  prestocks: "PreStocks",
};

/** The 11 standard (GICS) sectors, plus two for what fits none of them. */
export const SECTORS = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Financials",
  "Health Care",
  "Industrials",
  "Energy",
  "Materials",
  "Utilities",
  "Real Estate",
  /** Broad-market, bond, commodity and multi-sector ETFs. */
  "Diversified",
  /** No sector data from any source (e.g. some non-US listings). */
  "Unclassified",
] as const;
export type Sector = (typeof SECTORS)[number];

export type LiquidityTier = "high" | "medium" | "low";
export const LIQUIDITY_TIERS: readonly LiquidityTier[] = ["high", "medium", "low"];

/** Where an entry's sector and industry came from. */
export type SectorSource = "fmp" | "nasdaq" | "issuer" | "name" | "none";

export type StockEntry = {
  /** The company's (or fund's) ticker, shared by every issuer's token for it, e.g. NVDA. */
  ticker: string;
  companyName: string;
  type: "stock" | "etf";
  sector: Sector;
  industry: string | null;
  /** From the issuer's official list, verified on Jupiter. Never from a model. */
  mint: string;
  issuer: Issuer;
  liquidityTier: LiquidityTier;
  /** The token's own symbol, e.g. NVDAx, NVDAon, OPENAI. */
  symbol: string;
  decimals: number;
  /** Trading schedule, e.g. "24/5", "Market hours", "24/7". */
  hours: string;
  /** Pre-IPO exposure (PreStocks): no public market for the underlying. */
  preIpo: boolean;
  sectorSource: SectorSource;
  /** Price impact of the sync's 100 USDC test quote, percent. */
  testImpactPct: number;
};

export type RegistryFile = {
  syncedAt: string;
  testQuoteUsdc: number;
  sources: Record<Issuer, string>;
  stocks: StockEntry[];
};
