import { SOL_MINT } from "@/lib/tokens";

/**
 * The tokens on the home page's market dashboard: a few liquid Solana tokens
 * and tokenized stocks. Stock mints are copied from the verified stock
 * registry (config.test.ts fails if one ever differs; importing the registry
 * here would ship all of it to the browser). Crypto mints were checked as
 * verified on Jupiter's Tokens API (2026-10-10). USDC is the quote currency,
 * so it's never charted.
 *
 * `pool` is the GeckoTerminal pool used for price history: the one with the
 * most 24h volume that is at least 30 days old, chosen 2026-10-10. If it stops
 * returning data the server looks up the current top pool instead.
 */

export type MarketKind = "crypto" | "stock";

export type MarketToken = {
  mint: string;
  symbol: string;
  name: string;
  kind: MarketKind;
  /** Company ticker for stocks (what the assistant understands), else null. */
  ticker: string | null;
  pool: string | null;
};

const crypto = (mint: string, symbol: string, name: string, pool: string | null): MarketToken => ({
  mint,
  symbol,
  name,
  kind: "crypto",
  ticker: null,
  pool,
});

const stock = (
  mint: string,
  symbol: string,
  ticker: string,
  name: string,
  pool: string | null,
): MarketToken => ({ mint, symbol, name, kind: "stock", ticker, pool });

export const MARKET_TOKENS: readonly MarketToken[] = [
  crypto(SOL_MINT, "SOL", "Solana", "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE"),
  crypto(
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "JUP",
    "Jupiter",
    "C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg",
  ),
  crypto(
    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "RAY",
    "Raydium",
    "2AXXcN6oN9bBT5owwmTH53C7QHUXvhLeu718Kqt8rvY2",
  ),
  crypto(
    "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    "PYTH",
    "Pyth Network",
    "9n3dSLrERZQp95dHXywft7xV8D8xnGFLaUHtEhQVaXaC",
  ),
  stock(
    "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    "NVDAx",
    "NVDA",
    "NVIDIA",
    "49iMatQtoyabsYAQc8GafVq6aeBFVDxSRH44oiatyyw6",
  ),
  stock(
    "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    "TSLAx",
    "TSLA",
    "Tesla",
    "8aDaBQkTrS6HVMjyc6EZebgdiaXhLYGriDWKWWp1NpFF",
  ),
  stock(
    "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    "AAPLx",
    "AAPL",
    "Apple",
    "CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y",
  ),
  stock(
    "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    "SPYx",
    "SPY",
    "S&P 500 ETF",
    "4pCZCVEiYyT4efNdXUdL2tJF8VGMgiMXrZWq6FiNXhRw",
  ),
];

export const MARKET_MINTS = MARKET_TOKENS.map((t) => t.mint);

export const marketToken = (mint: string) => MARKET_TOKENS.find((t) => t.mint === mint) ?? null;

export type WindowId = "1h" | "24h" | "7d" | "30d";

export type WindowSpec = {
  id: WindowId;
  label: string;
  secs: number;
  /** GeckoTerminal OHLCV resolution. */
  timeframe: "minute" | "hour" | "day";
  aggregate: number;
  limit: number;
  /** How long the server keeps this history before asking again. */
  ttlMs: number;
};

export const WINDOWS: Record<WindowId, WindowSpec> = {
  "1h": {
    id: "1h",
    label: "1H",
    secs: 3600,
    timeframe: "minute",
    aggregate: 1,
    limit: 60,
    ttlMs: 2 * 60_000,
  },
  "24h": {
    id: "24h",
    label: "24H",
    secs: 86_400,
    timeframe: "minute",
    aggregate: 15,
    limit: 96,
    ttlMs: 10 * 60_000,
  },
  "7d": {
    id: "7d",
    label: "7D",
    secs: 604_800,
    timeframe: "hour",
    aggregate: 1,
    limit: 168,
    ttlMs: 30 * 60_000,
  },
  "30d": {
    id: "30d",
    label: "30D",
    secs: 2_592_000,
    timeframe: "hour",
    aggregate: 4,
    limit: 180,
    ttlMs: 2 * 3_600_000,
  },
};

export const WINDOW_IDS = Object.keys(WINDOWS) as WindowId[];

/** Seconds per candle for a window. */
export const candleSecs = (w: WindowSpec) =>
  (w.timeframe === "minute" ? 60 : w.timeframe === "hour" ? 3600 : 86_400) * w.aggregate;

/** How often the browser asks for live prices (one request for every token). */
export const PRICE_POLL_MS = 8_000;
