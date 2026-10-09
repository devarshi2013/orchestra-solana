import "server-only";

import { z } from "zod";

import type { BrowseMetrics } from "@/lib/stocks/browse";
import { STOCKS } from "@/lib/stocks/registry";
import { LIQUIDITY_TIERS, type StockEntry } from "@/lib/stocks/types";
import { cached } from "@/server/cache";
import { jupiterFetch } from "@/server/jupiter/client";
import { fetchBatchPriceChange, fetchBatchQuotes, fmpConfigured } from "@/server/market/fmp";

/**
 * Figures the "Browse stocks" panel sorts by, for every registry company.
 * - 24h change: live from Jupiter's Price API, for each company's most liquid
 *   token. Every issuer's token is priced, and a company whose tokens
 *   disagree by over 5% gets no change (a thin token's price can be far off).
 * - Market cap and 1Y return: the real company's, from Financial Modeling
 *   Prep's batch endpoints, only when MARKET_DATA_API_KEY is set and the plan
 *   allows them. Otherwise they're reported unavailable, never estimated.
 */

const CHANGE_TTL_MS = 5 * 60_000;
const FUNDAMENTALS_TTL_MS = 24 * 3_600_000;
/** Jupiter's Price API takes up to 50 ids per call; calls are spaced for the 1 RPS plan. */
const PRICE_BATCH = 50;
const PRICE_GAP_MS = 1_100;
const FMP_BATCH = 100;
const MAX_ISSUER_SPREAD = 0.05;

export type BrowseMetricsResult = {
  metrics: Record<string, BrowseMetrics>;
  available: { mcap: boolean; change: boolean; return: boolean };
};

const priceSchema = z.record(
  z.string(),
  // Jupiter leaves usdPrice out for tokens it can't price reliably.
  z.object({ usdPrice: z.number().nullish(), priceChange24h: z.number().nullish() }).passthrough(),
);

const byTicker = () => {
  const map = new Map<string, StockEntry[]>();
  for (const s of STOCKS) map.set(s.ticker, [...(map.get(s.ticker) ?? []), s]);
  return map;
};

const bestToken = (tokens: StockEntry[]) =>
  [...tokens].sort(
    (a, b) =>
      LIQUIDITY_TIERS.indexOf(a.liquidityTier) - LIQUIDITY_TIERS.indexOf(b.liquidityTier) ||
      a.testImpactPct - b.testImpactPct,
  )[0]!;

const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ticker → 24h change (percent), or null when it can't be trusted. Throws if Jupiter fails (not cached). */
function changes(): Promise<Record<string, number | null>> {
  return cached("browse:changes", CHANGE_TTL_MS, async () => {
    const tickers = byTicker();
    const mints = [...new Set(STOCKS.map((s) => s.mint))];
    const prices: z.infer<typeof priceSchema> = {};
    for (const [i, batch] of chunks(mints, PRICE_BATCH).entries()) {
      if (i > 0) await sleep(PRICE_GAP_MS);
      const response = await jupiterFetch("price/v3", { query: { ids: batch.join(",") } });
      Object.assign(prices, priceSchema.parse(await response.json()));
    }
    const out: Record<string, number | null> = {};
    for (const [ticker, tokens] of tickers) {
      const quoted = tokens.flatMap((t) => prices[t.mint]?.usdPrice ?? []);
      const spread = quoted.length > 1 ? Math.max(...quoted) / Math.min(...quoted) - 1 : 0;
      const change = prices[bestToken(tokens).mint]?.priceChange24h;
      out[ticker] = spread > MAX_ISSUER_SPREAD || change == null ? null : change;
    }
    return out;
  });
}

type Fundamentals = {
  marketCap: Record<string, number | null> | null;
  return1y: Record<string, number | null> | null;
};

/** Market caps and 1Y returns from FMP's batch endpoints; each null when unavailable. */
function fundamentals(): Promise<Fundamentals> {
  return cached("browse:fundamentals", FUNDAMENTALS_TTL_MS, async () => {
    if (!fmpConfigured()) return { marketCap: null, return1y: null };
    const symbols = [...byTicker().keys()];
    const load = async <R>(
      name: string,
      fetchBatch: (s: string[]) => Promise<R[]>,
      pick: (r: R) => [string, number | null],
    ) => {
      try {
        const out: Record<string, number | null> = {};
        for (const batch of chunks(symbols, FMP_BATCH)) {
          for (const row of await fetchBatch(batch)) {
            const [symbol, value] = pick(row);
            out[symbol] = value;
          }
        }
        return Object.keys(out).length > 0 ? out : null;
      } catch (error) {
        // Most often the plan doesn't include batch endpoints: the sort stays off.
        console.warn(
          `[browse] ${name} unavailable:`,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    };
    const [marketCap, return1y] = await Promise.all([
      load("market caps", fetchBatchQuotes, (r) => [r.symbol, r.marketCap ?? null]),
      load("1Y returns", fetchBatchPriceChange, (r) => [r.symbol, r["1Y"] ?? null]),
    ]);
    return { marketCap, return1y };
  });
}

export async function getBrowseMetrics(): Promise<BrowseMetricsResult> {
  const [change, fund] = await Promise.all([
    changes().catch((error: unknown) => {
      console.error("[browse] prices failed:", error instanceof Error ? error.message : error);
      return null;
    }),
    fundamentals(),
  ]);
  const metrics: Record<string, BrowseMetrics> = {};
  for (const ticker of byTicker().keys()) {
    metrics[ticker] = {
      marketCap: fund.marketCap?.[ticker] ?? null,
      change24h: change?.[ticker] ?? null,
      return1y: fund.return1y?.[ticker] ?? null,
    };
  }
  return {
    metrics,
    available: {
      mcap: fund.marketCap !== null,
      change: change !== null,
      return: fund.return1y !== null,
    },
  };
}
