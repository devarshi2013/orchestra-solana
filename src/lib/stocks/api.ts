import type { Candle } from "@/lib/market/series";

import type { Stock } from "./types";

/**
 * Response shapes of the stock routes the browser reads. Every list comes live
 * from Jupiter (src/server/stocks/universe.ts); errors are the usual
 * `{ error: { message } }` envelope, never stale or substitute data.
 */

/** GET /api/stocks → every listed company, most liquid first. */
export type StocksResponse = { stocks: Stock[]; asOf: string };

/** GET /api/stocks/search?q= → Jupiter's token search, kept to stock tokens, as companies. */
export type StockSearchResponse = { stocks: Stock[] };

/** GET /api/stocks/[ticker] → one company (404 when the ticker or symbol isn't listed). */
export type StockResponse = { stock: Stock; asOf: string };

/** Chart timeframes, as on tokens.xyz. */
export const CHART_WINDOWS = ["24h", "7d", "30d", "90d", "1y"] as const;
export type ChartWindow = (typeof CHART_WINDOWS)[number];

/**
 * GET /api/stocks/history?mint=&window= → candles of the token's most liquid
 * pool. `candles` is empty when the token has no pool with history (e.g. RFQ-only
 * tokens); that is shown as "no chart data", never filled in.
 */
export type StockHistoryResponse = { mint: string; window: ChartWindow; candles: Candle[] };
