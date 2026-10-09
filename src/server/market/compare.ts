import "server-only";

import { z } from "zod";

import { mintInformationSchema } from "@/lib/jupiter/schemas";
import { WINDOWS } from "@/lib/market/config";
import type { Candle, Point } from "@/lib/market/series";
import { resolveTicker } from "@/lib/stocks/registry";
import { LIQUIDITY_TIERS, type StockEntry } from "@/lib/stocks/types";
import { cached } from "@/server/cache";
import { jupiterFetch } from "@/server/jupiter/client";

import { getHistory } from "./history";

/**
 * Live data for the tickers in a chat comparison table: each one's most
 * liquid token (from the registry, never from the model), its Jupiter price
 * and logo, and a 7-day sparkline from GeckoTerminal. One Jupiter price call
 * and one token call per set of tickers, cached briefly. Jupiter's price for
 * a thinly traded token can be far off, so every issuer's token is priced and
 * a stock whose tokens disagree gets no price rather than a wrong one.
 */

export const MAX_COMPARE_TICKERS = 12;
const PRICE_TTL_MS = 15_000;
/** Issuers' prices for one stock further apart than this mean one of them is wrong. */
const MAX_ISSUER_SPREAD = 0.05;
const ICON_TTL_MS = 3_600_000;
const SPARKLINE_WINDOW = WINDOWS["7d"];

export type CompareRow = {
  symbol: string;
  icon: string | null;
  /** Null when Jupiter has no price, or the issuers' tokens disagree (see `priceNote`). */
  price: number | null;
  priceNote: string | null;
  change24h: number | null;
  /** Closes over the last 7 days; null while loading or when there's no history. */
  sparkline: Point[] | null;
};

export type CompareResult = {
  /** Ticker → live data. */
  rows: Record<string, CompareRow>;
  /** Tickers whose sparkline is still loading: ask again shortly. */
  pending: string[];
  /** Tickers that aren't in the registry. */
  unknown: string[];
};

const priceSchema = z.record(
  z.string(),
  z.object({ usdPrice: z.number(), priceChange24h: z.number().nullish() }).passthrough(),
);

/**
 * Closes for a sparkline, without bad prints: a thin pool can record a trade
 * far from the market (NVDAon once showed $2.25M). Closes more than 25% from
 * the series' median are dropped; if that's over a tenth of them, the history
 * isn't trusted at all. Nothing is smoothed or filled in.
 */
export function sparklinePoints(candles: readonly Candle[]): Point[] | null {
  if (candles.length < 2) return null;
  const closes = candles.map((c) => c.close).sort((a, b) => a - b);
  const median = closes[Math.floor(closes.length / 2)]!;
  const kept = candles.filter((c) => Math.abs(c.close / median - 1) <= 0.25);
  if (kept.length < 2 || kept.length < candles.length * 0.9) return null;
  return kept.map((c) => ({ time: c.time, value: c.close }));
}

/** The token a ticker's live data comes from: the most liquid issuer's. */
function bestToken(candidates: StockEntry[]): StockEntry {
  return [...candidates].sort(
    (a, b) =>
      LIQUIDITY_TIERS.indexOf(a.liquidityTier) - LIQUIDITY_TIERS.indexOf(b.liquidityTier) ||
      a.testImpactPct - b.testImpactPct,
  )[0]!;
}

function prices(mints: string[]) {
  return cached(`compare:prices:${mints.join(",")}`, PRICE_TTL_MS, async () => {
    const response = await jupiterFetch("price/v3", { query: { ids: mints.join(",") } });
    return priceSchema.parse(await response.json());
  });
}

function icons(mints: string[]) {
  return cached(`compare:icons:${mints.join(",")}`, ICON_TTL_MS, async () => {
    const response = await jupiterFetch("tokens/v2/search", { query: { query: mints.join(",") } });
    const tokens = z.array(mintInformationSchema).parse(await response.json());
    return Object.fromEntries(tokens.map((t) => [t.id, t.icon ?? null]));
  });
}

export async function getComparison(tickers: readonly string[]): Promise<CompareResult> {
  const result: CompareResult = { rows: {}, pending: [], unknown: [] };
  const stocks = new Map<string, { best: StockEntry; all: StockEntry[]; chart: StockEntry }>();
  for (const ticker of tickers) {
    const resolved = resolveTicker(ticker);
    if (!resolved.ok) {
      result.unknown.push(ticker);
      continue;
    }
    const best = bestToken(resolved.candidates);
    // xStocks trade in AMM pools, so their DEX history is the most complete;
    // Ondo tokens mostly trade by RFQ and their pools record few, noisy trades.
    const chart = resolved.candidates.find((t) => t.issuer === "xstocks") ?? best;
    stocks.set(ticker, { best, all: resolved.candidates, chart });
  }
  if (stocks.size === 0) return result;

  const sorted = (list: StockEntry[]) => [...new Set(list.map((t) => t.mint))].sort();
  const allMints = sorted([...stocks.values()].flatMap((s) => s.all));
  const bestMints = sorted([...stocks.values()].map((s) => s.best));
  const chartMints = sorted([...stocks.values()].map((s) => s.chart));
  const [priceMap, iconMap, history] = await Promise.all([
    prices(allMints).catch(() => null),
    icons(bestMints).catch(() => null),
    getHistory(chartMints, SPARKLINE_WINDOW, 5_000),
  ]);

  for (const [ticker, { best, all, chart }] of stocks) {
    const price = priceMap?.[best.mint];
    const quoted = all.flatMap((t) => priceMap?.[t.mint]?.usdPrice ?? []);
    const spread = quoted.length > 1 ? Math.max(...quoted) / Math.min(...quoted) - 1 : 0;
    const disagree = spread > MAX_ISSUER_SPREAD;
    const candles = history.series[chart.mint];
    result.rows[ticker] = {
      symbol: best.symbol,
      icon: iconMap?.[best.mint] ?? null,
      price: disagree ? null : (price?.usdPrice ?? null),
      priceNote: disagree
        ? `Issuers' prices differ by ${Math.round(spread * 100)}%, so no single price is shown`
        : null,
      change24h: disagree ? null : (price?.priceChange24h ?? null),
      sparkline: candles ? sparklinePoints(candles) : null,
    };
    if (history.pending.includes(chart.mint)) result.pending.push(ticker);
  }
  return result;
}
