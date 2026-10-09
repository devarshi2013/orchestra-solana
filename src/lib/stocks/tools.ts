import "server-only";

import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { classifyOrderError } from "@/lib/swap/errors";
import { SOL_MINT, USDC_MINT } from "@/lib/tokens";
import { toBaseUnits, toUnits, USDC_DECIMALS } from "@/lib/units";
import { cached } from "@/server/cache";
import { JupiterApiError } from "@/server/jupiter/client";
import { paced } from "@/server/jupiter/pace";
import { getOrder } from "@/server/jupiter/swap";
import {
  fetchAnnualGrowth,
  fetchPriceChange,
  fetchProfile,
  fetchRatiosTtm,
  fmpConfigured,
} from "@/server/market/fmp";
import { getWalletBalances as readWalletBalances } from "@/server/solana/rpc";

import { pickBest, totalCostPct } from "./best";
import { listStocks, normalizeSector, resolveTicker, STOCKS } from "./registry";
import { TIER_LIMITS } from "./sync-core";
import { ISSUER_NAMES, SECTORS, type StockEntry } from "./types";

/**
 * Server-side tools over Orchestra's stock registry (src/lib/stocks), e.g. for an assistant.
 * Every input is Zod-validated. Assets are named by ticker or token symbol
 * and resolved ONLY through the registry: no tool accepts a mint address, so
 * nothing outside the registry can be quoted or reported on.
 *
 * Every tool returns `{ data, reason }`: data, or null with the reason. A
 * missing number is null with an entry in `missing` explaining why; numbers
 * are never estimated or filled in. Market data is cached for 15 minutes;
 * quotes and balances are always live. See docs/market-tools.md.
 */

export type ToolResult<T> = { data: T; reason: null } | { data: null; reason: string };
const ok = <T>(data: T): ToolResult<T> => ({ data, reason: null });
const fail = <T>(reason: string): ToolResult<T> => ({ data: null, reason });

/** Field → why it is null. */
export type Missing = Record<string, string>;

export const MARKET_DATA_TTL_MS = 15 * 60_000;

const message = (error: unknown) => {
  if (error instanceof JupiterApiError) {
    try {
      return (JSON.parse(error.body) as { error?: string }).error ?? error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : String(error);
};

function parse<T>(schema: z.ZodType<T>, input: unknown): { value: T } | { reason: string } {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { value: parsed.data }
    : { reason: `Invalid input: ${z.prettifyError(parsed.error)}` };
}

const tickerSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^\$?[A-Za-z0-9.]+$/, "Use a ticker or token symbol, not an address");

// --- listStocks ---------------------------------------------------------------

export const listStocksInput = z
  .object({
    /** A standard sector (Technology, Financials, Health Care, …) or a common alias ("tech", "banks"). */
    sector: z.string().trim().min(1).max(60).optional(),
    /** Part of an industry name, e.g. "semiconductor", "bank", "oil". */
    industry: z.string().trim().min(1).max(60).optional(),
    type: z.enum(["stock", "etf"]).optional(),
    /** Part of a ticker, token symbol or company name. */
    search: z.string().trim().min(1).max(60).optional(),
    /** The least liquid tier to include: "high", "medium" (high + medium) or "low" (all). */
    minLiquidity: z.enum(["high", "medium", "low"]).optional(),
  })
  .strict();

/** Most companies returned per call; narrow the filters for more. */
export const MAX_LISTED = 60;

export type StockListing = {
  searched: {
    sectors: string[];
    industry: string | null;
    type: string;
    search: string | null;
    minLiquidity: string;
  };
  total: number;
  shown: number;
  companies: {
    ticker: string;
    companyName: string;
    type: "stock" | "etf";
    sector: string;
    industry: string | null;
    liquidityTier: string;
    preIpo: boolean;
    issuers: { issuer: string; symbol: string; liquidityTier: string }[];
  }[];
};

/**
 * The registry's companies (every tokenized stock and ETF buyable through
 * Jupiter), filtered, most liquid first. Never returns mints.
 */
export async function listStocksTool(input: unknown = {}): Promise<ToolResult<StockListing>> {
  const args = parse(listStocksInput, input);
  if ("reason" in args) return fail(args.reason);
  const filter = args.value;
  const sector = filter.sector ? normalizeSector(filter.sector) : null;
  if (filter.sector && !sector) {
    return fail(`Unknown sector "${filter.sector}". Use one of: ${SECTORS.join(", ")}.`);
  }
  const matches = listStocks(filter);
  return ok({
    searched: {
      sectors: sector ? [sector] : ["all sectors"],
      industry: filter.industry ?? null,
      type: filter.type ?? "stocks and ETFs",
      search: filter.search ?? null,
      minLiquidity: filter.minLiquidity ?? "low (all tiers)",
    },
    total: matches.length,
    shown: Math.min(matches.length, MAX_LISTED),
    companies: matches.slice(0, MAX_LISTED).map((c) => ({
      ticker: c.ticker,
      companyName: c.companyName,
      type: c.type,
      sector: c.sector,
      industry: c.industry,
      liquidityTier: c.liquidityTier,
      preIpo: c.preIpo,
      issuers: c.issuers.map((i) => ({
        issuer: ISSUER_NAMES[i.issuer],
        symbol: i.symbol,
        liquidityTier: i.liquidityTier,
      })),
    })),
  });
}

// --- getStockMetrics ----------------------------------------------------------

export const tickersInput = z.array(tickerSchema).min(1).max(20);

export type StockMetrics = {
  /** The real company's ticker. */
  ticker: string;
  name: string | null;
  /** Tokenized versions in the registry. */
  tokens: { symbol: string; issuer: string }[];
  isEtf: boolean | null;
  marketCapUsd: number | null;
  peRatio: number | null;
  /** Latest annual revenue growth, percent. */
  revenueGrowthPct: number | null;
  return1MPct: number | null;
  return6MPct: number | null;
  return1YPct: number | null;
  source: "Financial Modeling Prep";
  fetchedAt: string;
  missing: Missing;
};

export type PerTicker<T> = { ticker: string } & ToolResult<T>;

const settle = async <T>(promise: Promise<T>): Promise<{ value: T | null; error?: string }> => {
  try {
    return { value: await promise };
  } catch (error) {
    return { value: null, error: message(error) };
  }
};

async function stockMetrics(
  ticker: string,
  tokens: StockEntry[],
): Promise<ToolResult<StockMetrics>> {
  const key = (what: string) => `fmp:${what}:${ticker}`;
  const [profile, change, ratios, growth] = await Promise.all([
    settle(cached(key("profile"), MARKET_DATA_TTL_MS, () => fetchProfile(ticker))),
    settle(cached(key("change"), MARKET_DATA_TTL_MS, () => fetchPriceChange(ticker))),
    settle(cached(key("ratios"), MARKET_DATA_TTL_MS, () => fetchRatiosTtm(ticker))),
    settle(cached(key("growth"), MARKET_DATA_TTL_MS, () => fetchAnnualGrowth(ticker))),
  ]);
  const all = [profile, change, ratios, growth];
  if (all.every((r) => r.value === null)) {
    return fail(
      all.find((r) => r.error)?.error ?? `Financial Modeling Prep has no data for ${ticker}`,
    );
  }

  const missing: Missing = {};
  /** The value, or null with the reason recorded. */
  const field = <T>(name: string, value: T | null | undefined, why: string): T | null => {
    if (value === null || value === undefined) {
      missing[name] = why;
      return null;
    }
    return value;
  };
  const absent = (r: { error?: string }, what: string) =>
    r.error ?? `Financial Modeling Prep returned no ${what}`;
  const isEtf = profile.value ? Boolean(profile.value.isEtf || profile.value.isFund) : null;

  let peRatio: number | null = null;
  let revenueGrowthPct: number | null = null;
  if (isEtf) {
    missing.peRatio = "Not applicable to an ETF or fund";
    missing.revenueGrowthPct = "Not applicable to an ETF or fund";
  } else {
    const pe = ratios.value?.priceToEarningsRatioTTM ?? ratios.value?.peRatioTTM;
    if (pe !== null && pe !== undefined && pe <= 0) {
      missing.peRatio = "Negative earnings: P/E isn't meaningful";
    } else {
      peRatio = field("peRatio", pe, absent(ratios, "P/E"));
    }
    const fraction = growth.value?.revenueGrowth ?? growth.value?.growthRevenue;
    revenueGrowthPct = field(
      "revenueGrowthPct",
      fraction === null || fraction === undefined ? null : fraction * 100,
      absent(growth, "revenue growth"),
    );
  }

  return ok({
    ticker,
    name: profile.value?.companyName ?? tokens[0]?.companyName ?? null,
    tokens: tokens.map((t) => ({ symbol: t.symbol, issuer: ISSUER_NAMES[t.issuer] })),
    isEtf,
    marketCapUsd: field("marketCapUsd", profile.value?.marketCap, absent(profile, "market cap")),
    peRatio,
    revenueGrowthPct,
    return1MPct: field("return1MPct", change.value?.["1M"], absent(change, "1M return")),
    return6MPct: field("return6MPct", change.value?.["6M"], absent(change, "6M return")),
    return1YPct: field("return1YPct", change.value?.["1Y"], absent(change, "1Y return")),
    source: "Financial Modeling Prep",
    fetchedAt: new Date().toISOString(),
    missing,
  });
}

/**
 * Fundamentals and returns for the real companies behind tokenized stocks in
 * the registry (by ticker, e.g. NVDA, or token symbol, e.g. NVDAx).
 */
export async function getStockMetrics(
  input: unknown,
): Promise<ToolResult<PerTicker<StockMetrics>[]>> {
  const args = parse(tickersInput, input);
  if ("reason" in args) return fail(args.reason);
  const results = await Promise.all(
    args.value.map(async (ticker): Promise<PerTicker<StockMetrics>> => {
      // Any issuer's token (or the bare ticker) means the same company.
      const found = resolveTicker(ticker);
      if (!found.ok) return { ticker, ...fail<StockMetrics>(found.reason) };
      if (found.candidates.every((c) => c.preIpo)) {
        return {
          ticker,
          ...fail<StockMetrics>(
            "A private company (pre-IPO PreStocks token): there's no public market data for it",
          ),
        };
      }
      if (!fmpConfigured()) {
        return {
          ticker,
          ...fail<StockMetrics>(
            "Stock fundamentals need MARKET_DATA_API_KEY (Financial Modeling Prep)",
          ),
        };
      }
      const tokens = STOCKS.filter((s) => s.ticker === found.ticker);
      return { ticker, ...(await stockMetrics(found.ticker, tokens)) };
    }),
  );
  return ok(results);
}

// --- getSwapQuote -------------------------------------------------------------

export const swapQuoteInput = z
  .object({
    ticker: tickerSchema,
    /** USDC to spend, in whole USDC. */
    usdcAmount: z.number().finite().positive().max(1_000_000),
    /** The wallet that would swap (Jupiter sizes fees and checks balances for it). */
    wallet: base58AddressSchema,
  })
  .strict();

export type SwapQuote = {
  ticker: string;
  companyName: string;
  /** The token chosen: the issuer with the lowest total cost for this buy. */
  symbol: string;
  issuer: string;
  liquidityTier: string;
  usdcIn: number;
  /** Tokens out before slippage. */
  expectedOut: number;
  /** Least tokens out after the slippage tolerance; null when Jupiter doesn't say. */
  minimumOut: number | null;
  /** Absolute price impact, percent. */
  priceImpactPct: number | null;
  /** Thin when price impact exceeds the medium-liquidity limit. */
  thinLiquidity: boolean;
  feeBps: number | null;
  /** Signature + priority + rent fees the wallet pays, in SOL. */
  networkFeesSol: number | null;
  gasless: boolean;
  router: string;
  /** Set when Jupiter priced it but couldn't build it for this wallet (e.g. too little USDC). */
  warning: string | null;
  /** Every issuer's token that was quoted, cheapest first (total cost = impact + fee). */
  issuersCompared: {
    symbol: string;
    issuer: string;
    totalCostPct: number | null;
    note: string | null;
  }[];
  /** Always false: this tool only quotes. */
  executed: false;
  quotedAt: string;
};

/** The chosen token (with its registry mint) and its quote; the mint never goes to the model. */
export type BestQuote = { entry: StockEntry; quote: SwapQuote };

const MAX_CANDIDATES = 4;

/**
 * Live Jupiter /order quotes for spending `usdcAmount` USDC on a company from
 * `wallet`: every issuer's token for it (or just the token symbol given), the
 * cheapest chosen. Never signs, sends or returns a transaction.
 */
export async function quoteBestIssuer(
  ticker: string,
  usdcAmount: number,
  wallet: string,
): Promise<ToolResult<BestQuote>> {
  const found = resolveTicker(ticker);
  if (!found.ok) return fail(found.reason);
  // RFQ (JupiterZ) quotes don't check the taker's balance, so read it ourselves.
  const usdcHeld = readWalletBalances(wallet)
    .then((balances) => toUnits(balances[USDC_MINT]?.amount ?? "0", USDC_DECIMALS))
    .catch(() => null);

  const candidates = found.candidates.slice(0, MAX_CANDIDATES);
  const quoted = [];
  for (const entry of candidates) {
    try {
      // Paced: one company can mean several quotes, within Jupiter's rate limit.
      const order = await paced(() =>
        getOrder({
          inputMint: USDC_MINT,
          outputMint: entry.mint,
          amount: toBaseUnits(usdcAmount, USDC_DECIMALS).toString(),
          taker: wallet,
        }),
      );
      quoted.push({ entry, order, error: null as string | null });
    } catch (error) {
      quoted.push({ entry, order: null, error: message(error) });
    }
  }
  const held = await usdcHeld;
  const views = quoted.map(({ entry, order, error }) => {
    const unbuildable = order && order.transaction === "" ? classifyOrderError(order) : null;
    const impact =
      order?.priceImpact === null || order?.priceImpact === undefined
        ? null
        : Math.abs(order.priceImpact);
    return {
      entry,
      order,
      impact,
      note: error
        ? `No quote: ${error}`
        : unbuildable
          ? `${unbuildable.title}: ${unbuildable.message}`
          : null,
      candidate: {
        symbol: entry.symbol,
        liquidityTier: entry.liquidityTier,
        priceImpactPct: impact,
        feeBps: order?.feeBps ?? null,
        // Unbuildable for this wallet (e.g. too little USDC) still prices the route;
        // prefer buildable ones, but fall back to the best price when none is.
        buildable: Boolean(order && order.outAmount && order.outAmount !== "0"),
      },
    };
  });
  const buildableNow = views.filter((v) => v.candidate.buildable && v.note === null);
  const pool = buildableNow.length > 0 ? buildableNow : views;
  const bestIndex = pickBest(pool.map((v) => v.candidate));
  if (bestIndex === -1) {
    return fail(
      `Jupiter couldn't quote ${found.ticker}: ${views.map((v) => `${v.entry.symbol} (${v.note ?? "no route"})`).join(", ")}`,
    );
  }
  const best = pool[bestIndex]!;
  const order = best.order!;
  const lamports = [
    order.signatureFeeLamports,
    order.prioritizationFeeLamports,
    order.rentFeeLamports,
  ];
  const issuersCompared = views
    .map((v) => ({
      symbol: v.entry.symbol,
      issuer: ISSUER_NAMES[v.entry.issuer],
      totalCostPct: Number.isFinite(totalCostPct(v.candidate))
        ? Number(totalCostPct(v.candidate).toFixed(4))
        : null,
      note: v.note,
    }))
    .sort((a, b) => (a.totalCostPct ?? Infinity) - (b.totalCostPct ?? Infinity));
  return ok({
    entry: best.entry,
    quote: {
      ticker: found.ticker,
      companyName: found.companyName,
      symbol: best.entry.symbol,
      issuer: ISSUER_NAMES[best.entry.issuer],
      liquidityTier: best.entry.liquidityTier,
      usdcIn: toUnits(order.inAmount, USDC_DECIMALS),
      expectedOut: toUnits(order.outAmount, best.entry.decimals),
      minimumOut: order.otherAmountThreshold
        ? toUnits(order.otherAmountThreshold, best.entry.decimals)
        : null,
      priceImpactPct: best.impact,
      thinLiquidity: best.impact !== null && best.impact > TIER_LIMITS.medium,
      feeBps: order.feeBps ?? null,
      networkFeesSol: lamports.every((l) => l === null || l === undefined)
        ? null
        : lamports.reduce<number>((sum, l) => sum + (l ?? 0), 0) / 1e9,
      gasless: Boolean(order.gasless),
      router: order.router,
      warning:
        best.note ??
        (held !== null && held < usdcAmount
          ? `The wallet holds ${held} USDC, less than the ${usdcAmount} USDC quoted`
          : null),
      issuersCompared,
      executed: false,
      quotedAt: new Date().toISOString(),
    },
  });
}

/** The getSwapQuote tool: the best issuer's quote, without the mint. */
export async function getSwapQuote(input: unknown): Promise<ToolResult<SwapQuote>> {
  const args = parse(swapQuoteInput, input);
  if ("reason" in args) return fail(args.reason);
  const result = await quoteBestIssuer(args.value.ticker, args.value.usdcAmount, args.value.wallet);
  return result.data ? ok(result.data.quote) : fail(result.reason);
}

// --- getWalletBalances --------------------------------------------------------

export const walletInput = base58AddressSchema;

export type WalletBalances = {
  wallet: string;
  /** Native SOL. */
  sol: number;
  usdc: number;
  readAt: string;
};

/** USDC and SOL held by `wallet`, read live over RPC. */
export async function getWalletBalances(input: unknown): Promise<ToolResult<WalletBalances>> {
  const args = parse(walletInput, input);
  if ("reason" in args) return fail(args.reason);
  try {
    const balances = await readWalletBalances(args.value);
    const sol = balances[SOL_MINT];
    const usdc = balances[USDC_MINT];
    return ok({
      wallet: args.value,
      sol: sol ? toUnits(sol.amount, sol.decimals) : 0,
      usdc: usdc ? toUnits(usdc.amount, usdc.decimals) : 0,
      readAt: new Date().toISOString(),
    });
  } catch (error) {
    return fail(`Couldn't read the wallet: ${message(error)}`);
  }
}

/** The tools with descriptions and input schemas, e.g. for an assistant's tool list. */
export const STOCK_TOOLS = {
  listStocks: {
    description:
      "List the tokenized stocks and ETFs buyable through Jupiter, by sector, industry, type, search and minimum liquidity.",
    input: listStocksInput,
    run: listStocksTool,
  },
  getStockMetrics: {
    description:
      "Market cap, P/E, revenue growth and 1M/6M/1Y returns for the companies behind registry stocks.",
    input: tickersInput,
    run: getStockMetrics,
  },
  getSwapQuote: {
    description:
      "A live Jupiter quote for spending USDC on a company: every issuer's token compared, the cheapest chosen. Never executes.",
    input: swapQuoteInput,
    run: getSwapQuote,
  },
  getWalletBalances: {
    description: "A wallet's USDC and SOL balances.",
    input: walletInput,
    run: getWalletBalances,
  },
} as const;
