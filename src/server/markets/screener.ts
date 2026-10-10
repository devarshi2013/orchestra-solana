import "server-only";

import { z } from "zod";

import { mintInformationSchema } from "@/lib/jupiter/schemas";
import { MARKET_TOKENS, WINDOWS, type WindowId } from "@/lib/market/config";
import type { Candle, Point } from "@/lib/market/series";
import type { ExampleQuote, MarketCategory, MarketOverview, MarketRow } from "@/lib/markets/types";
import { REGISTRY, STOCKS } from "@/lib/stocks/registry";
import { USDC_MINT } from "@/lib/tokens";
import { toBaseUnits, toUnits, USDC_DECIMALS } from "@/lib/units";
import { ISSUER_NAMES, type StockEntry } from "@/lib/stocks/types";
import { cached } from "@/server/cache";
import { jupiterFetch } from "@/server/jupiter/client";
import { paced } from "@/server/jupiter/pace";
import { getOrder } from "@/server/jupiter/swap";
import { bestToken, sparklinePoints } from "@/server/market/compare";
import { getHistory, loadCandles, primePools } from "@/server/market/history";

/**
 * Data for the stocks screener (/markets) and the stock pages, from the
 * registry (the only source of tokens and mints) and Jupiter's Tokens v2 and
 * Price v3 APIs, called with the server-side key only. Every response is
 * cached so any number of visitors costs Jupiter a few calls a minute:
 * - the list (logos, price, 24h change, market cap, volume, holders): one
 *   Tokens v2 call per 100 tokens (every issuer's, to cross-check prices),
 *   paced, cached 60 s;
 * - live prices for the rows on screen (every issuer's token, cross-checked):
 *   one Price v3 call per 50 mints, each price cached 10 s;
 * - 24h sparklines and chart candles from GeckoTerminal (Jupiter has no
 *   price-history API), cached per window.
 */

const LIST_TTL_MS = 60_000;
const PRICE_TTL_MS = 10_000;
const TOKENS_PER_CALL = 100;
const WARM_COUNT = 16;
export const PRICES_PER_CALL = 50;

const COMMODITY = /gold|silver|oil|natural gas|copper|platinum|palladium|commodit|precious/i;

function category(entry: StockEntry): MarketCategory {
  if (entry.type !== "etf") return "equity";
  return COMMODITY.test(entry.companyName) ? "commodity" : "etf";
}

/**
 * One token per company: the most liquid issuer's is traded; charts and the
 * price check use xStocks when there is one (AMM pools record full history).
 */
function companies() {
  const byTicker = new Map<string, StockEntry[]>();
  for (const entry of STOCKS)
    byTicker.set(entry.ticker, [...(byTicker.get(entry.ticker) ?? []), entry]);
  return [...byTicker.values()].map((all) => ({
    best: bestToken(all),
    chart: all.find((t) => t.issuer === "xstocks") ?? bestToken(all),
    all,
  }));
}

/** Issuers' prices for one stock further apart than this mean one of them is wrong. */
const MAX_ISSUER_SPREAD = 0.05;

/**
 * The price to show for a company, from its issuers' token prices. The
 * xStocks token's price is used when there is one: it trades in AMM pools
 * around the clock, so it tracks real trades and matches the chart. Jupiter's
 * price for RFQ-only tokens can drift (TSLAon read $397 while quotes filled at
 * $384) or be plain wrong (MSFTon $704 against $534). Without an xStocks
 * token the traded token's price is shown, unless the issuers disagree by
 * more than 5%, in which case none is.
 */
export function companyPrice(
  tokens: { mint: string; issuer: string }[],
  bestMint: string,
  prices: Record<string, LivePrice | undefined>,
): LivePrice | null {
  const xstocks = tokens.find((t) => t.issuer === "xstocks");
  if (xstocks && prices[xstocks.mint]) return prices[xstocks.mint]!;
  const quoted = tokens.flatMap((t) => (prices[t.mint] ? [prices[t.mint]!.price] : []));
  const spread = quoted.length > 1 ? Math.max(...quoted) / Math.min(...quoted) - 1 : 0;
  return spread <= MAX_ISSUER_SPREAD ? (prices[bestMint] ?? null) : null;
}

/** Every company ticker (one stock page each). */
export function listTickers(): string[] {
  return companies().map((c) => c.best.ticker);
}

/** A company's tokens by ticker (case-insensitive), or null when it isn't listed. */
export function companyTokens(ticker: string) {
  return companies().find((c) => c.best.ticker === ticker.toUpperCase()) ?? null;
}

const tokensSchema = z.array(mintInformationSchema);

/** Every company in the registry with Jupiter's stats for its token (nulls where Jupiter has none). */
type TokenInfo = z.infer<typeof mintInformationSchema>;

/** Jupiter's Tokens v2 data for some mints, 100 a call, paced. */
async function tokenInfo(mints: readonly string[]): Promise<Map<string, TokenInfo>> {
  const info = new Map<string, TokenInfo>();
  for (let i = 0; i < mints.length; i += TOKENS_PER_CALL) {
    const batch = mints.slice(i, i + TOKENS_PER_CALL);
    const response = await paced(() =>
      jupiterFetch("tokens/v2/search", { query: { query: batch.join(",") } }),
    );
    for (const token of tokensSchema.parse(await response.json())) info.set(token.id, token);
  }
  return info;
}

/** Every registry token's Jupiter data (cached 60 s; shared by the list and the totals). */
const registryInfo = () =>
  cached("markets:registry-info", LIST_TTL_MS, () => tokenInfo(STOCKS.map((s) => s.mint)));

const volumeOf = (t: TokenInfo | undefined): number | null => {
  const buy = t?.stats24h?.buyVolume;
  const sell = t?.stats24h?.sellVolume;
  return buy == null && sell == null ? null : (buy ?? 0) + (sell ?? 0);
};

export function listMarkets(): Promise<MarketRow[]> {
  return cached("markets:list", LIST_TTL_MS, async () => {
    const rows = companies();
    const info = await registryInfo();
    const list = rows.map(({ best, chart, all }) => {
      const t = info.get(best.mint);
      const tokenPrices = Object.fromEntries(
        all.flatMap((e) => {
          const ti = info.get(e.mint);
          return ti?.usdPrice
            ? [[e.mint, { price: ti.usdPrice, change24h: ti.stats24h?.priceChange ?? null }]]
            : [];
        }),
      );
      const shown = companyPrice(all, best.mint, tokenPrices);
      return {
        ticker: best.ticker,
        name: best.companyName,
        category: category(best),
        sector: best.sector,
        preIpo: best.preIpo,
        hours: best.hours,
        symbol: best.symbol,
        issuer: ISSUER_NAMES[best.issuer],
        mint: best.mint,
        decimals: best.decimals,
        chartMint: chart.mint,
        chartSymbol: chart.symbol,
        chartDecimals: chart.decimals,
        icon: t?.icon ?? null,
        price: shown?.price ?? null,
        change24h: shown?.change24h ?? null,
        marketCap: t?.mcap ?? null,
        volume24h: volumeOf(t),
        liquidity: t?.liquidity ?? null,
        holders: t?.holderCount ?? null,
      };
    });
    // Warm the 24h sparklines of the largest stocks in the background (the first screenful).
    const largest = [...list]
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      .slice(0, WARM_COUNT)
      .map((r) => r.ticker);
    void sparklines(largest).catch(() => {});
    return list;
  });
}

const priceSchema = z.record(
  z.string(),
  z.object({ usdPrice: z.number().nullish(), priceChange24h: z.number().nullish() }).passthrough(),
);
export type LivePrice = { price: number; change24h: number | null };
const priceCache = new Map<string, { at: number; value: LivePrice | null }>();

/**
 * Live prices for registry mints. Fresh cached prices (10 s) are reused; the
 * rest come from one Price v3 call per 50 mints.
 */
async function livePrices(mints: readonly string[]): Promise<Record<string, LivePrice>> {
  const now = Date.now();
  const stale = mints.filter((m) => (priceCache.get(m)?.at ?? 0) < now - PRICE_TTL_MS);
  for (let i = 0; i < stale.length; i += PRICES_PER_CALL) {
    const batch = [...stale.slice(i, i + PRICES_PER_CALL)].sort();
    const parsed = await cached(`markets:prices:${batch.join(",")}`, PRICE_TTL_MS, async () => {
      const response = await jupiterFetch("price/v3", { query: { ids: batch.join(",") } });
      return priceSchema.parse(await response.json());
    });
    for (const mint of batch) {
      const p = parsed[mint];
      priceCache.set(mint, {
        at: now,
        value: p?.usdPrice ? { price: p.usdPrice, change24h: p.priceChange24h ?? null } : null,
      });
    }
  }
  const result: Record<string, LivePrice> = {};
  for (const mint of mints) {
    const value = priceCache.get(mint)?.value;
    if (value) result[mint] = value;
  }
  return result;
}

const CRYPTO = MARKET_TOKENS.filter((t) => t.kind === "crypto");
const cryptoBySymbol = (symbol: string) => CRYPTO.find((t) => t.symbol === symbol.toUpperCase());

/** Sparklines for some stocks (by ticker) or crypto tokens (by symbol), answering within ~3 s; the rest are `pending`. */
export async function sparklines(
  tickers: readonly string[],
  window: "24h" | "7d" = "24h",
): Promise<{ series: Record<string, Point[] | null>; pending: string[] }> {
  const wanted = tickers.flatMap((t) => {
    const c = companyTokens(t);
    if (c) return [{ ticker: c.best.ticker, mint: c.chart.mint }];
    const token = cryptoBySymbol(t);
    return token ? [{ ticker: token.symbol, mint: token.mint }] : [];
  });
  const mints = wanted.map((w) => w.mint);
  // One batched pool lookup for all of them, then one candle request each (in the background).
  await Promise.race([primePools(mints), new Promise((resolve) => setTimeout(resolve, 2_500))]);
  const history = await getHistory(mints, WINDOWS[window], 3_000);
  const series: Record<string, Point[] | null> = {};
  const pending: string[] = [];
  for (const { ticker, mint } of wanted) {
    if (history.pending.includes(mint)) pending.push(ticker);
    else series[ticker] = history.series[mint] ? sparklinePoints(history.series[mint]) : null;
  }
  return { series, pending };
}

/** Candles for a stock's chart; throws when no history is available. */
export function chartCandles(ticker: string, window: WindowId): Promise<Candle[]> {
  const c = companyTokens(ticker);
  if (!c) throw new Error("Unknown stock");
  return loadCandles(c.chart.mint, WINDOWS[window], "now");
}

/** Live prices for some stocks (by ticker, checked across issuers) or crypto tokens (by symbol). */
export async function livePricesForTickers(
  tickers: readonly string[],
): Promise<Record<string, LivePrice>> {
  const wanted = tickers.flatMap((t) => companyTokens(t) ?? []);
  const coins = tickers.flatMap((t) => cryptoBySymbol(t) ?? []);
  const prices = await livePrices([
    ...new Set([...wanted.flatMap((c) => c.all.map((e) => e.mint)), ...coins.map((c) => c.mint)]),
  ]);
  const result: Record<string, LivePrice> = {};
  for (const c of wanted) {
    const price = companyPrice(c.all, c.best.mint, prices);
    if (price) result[c.best.ticker] = price;
  }
  for (const c of coins) if (prices[c.mint]) result[c.symbol] = prices[c.mint]!;
  return result;
}

/** True for a registry stock ticker or one of the listed crypto symbols. */
export const isListed = (ticker: string) =>
  Boolean(companyTokens(ticker) ?? cryptoBySymbol(ticker));

/** SOL, JUP and the other listed crypto tokens, in the same shape as the stock rows. */
function listCrypto(): Promise<MarketRow[]> {
  return cached("markets:crypto", LIST_TTL_MS, async () => {
    const info = await tokenInfo(CRYPTO.map((t) => t.mint));
    return CRYPTO.map((token) => {
      const t = info.get(token.mint);
      return {
        ticker: token.symbol,
        name: token.name,
        category: "crypto" as const,
        sector: "Crypto",
        preIpo: false,
        hours: "24/7",
        symbol: token.symbol,
        issuer: "",
        mint: token.mint,
        decimals: t?.decimals ?? 9,
        chartMint: token.mint,
        chartSymbol: token.symbol,
        chartDecimals: t?.decimals ?? 9,
        icon: t?.icon ?? null,
        price: t?.usdPrice ?? null,
        change24h: t?.stats24h?.priceChange ?? null,
        marketCap: t?.mcap ?? null,
        volume24h: volumeOf(t),
        liquidity: t?.liquidity ?? null,
        holders: t?.holderCount ?? null,
      };
    });
  });
}

/**
 * What the home page's live sections start from: the stock and crypto rows,
 * and totals computed from the registry (counts) and Jupiter (24h volume,
 * summed over the listed stock tokens that report one). Nothing is estimated.
 */
export function marketOverview(): Promise<MarketOverview> {
  return cached("markets:overview", LIST_TTL_MS, async () => {
    const [rows, crypto, info] = await Promise.all([listMarkets(), listCrypto(), registryInfo()]);
    const volumes = STOCKS.flatMap((s) => volumeOf(info.get(s.mint)) ?? []);
    return {
      rows,
      crypto,
      totals: {
        stocks: rows.length,
        tokens: STOCKS.length,
        sectors: new Set(STOCKS.map((s) => s.sector)).size,
        issuers: new Set(STOCKS.map((s) => s.issuer)).size,
        volume24h: volumes.length > 0 ? volumes.reduce((sum, v) => sum + v, 0) : null,
        volumeTokens: volumes.length,
      },
      verifiedAt: REGISTRY.syncedAt,
      asOf: new Date().toISOString(),
    };
  });
}

const EXAMPLE_TICKER = "NVDA";
const EXAMPLE_USDC = 10;
const EXAMPLE_TTL_MS = 30_000;

/**
 * A real Jupiter /order quote for spending 10 USDC on NVDA's xStocks token,
 * with no taker (so Jupiter returns pricing only, never a transaction).
 * Cached 30 s, so every visitor shares one Jupiter call per half minute.
 */
export function exampleQuote(): Promise<ExampleQuote> {
  return cached("markets:example-quote", EXAMPLE_TTL_MS, async () => {
    const token = companyTokens(EXAMPLE_TICKER)!.chart;
    const order = await paced(() =>
      getOrder({
        inputMint: USDC_MINT,
        outputMint: token.mint,
        amount: toBaseUnits(EXAMPLE_USDC, USDC_DECIMALS).toString(),
      }),
    );
    return {
      ticker: token.ticker,
      symbol: token.symbol,
      usdcIn: EXAMPLE_USDC,
      tokensOut: toUnits(order.outAmount, token.decimals),
      priceImpactPct:
        order.priceImpact === null || order.priceImpact === undefined
          ? null
          : Math.abs(order.priceImpact),
      feeBps: order.feeBps ?? null,
      asOf: new Date().toISOString(),
    };
  });
}
