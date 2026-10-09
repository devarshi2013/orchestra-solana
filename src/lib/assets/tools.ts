import "server-only";

import { z } from "zod";

import { MAX_TEST_QUOTE_IMPACT_PCT } from "@/lib/assets/config";
import { ISSUER_NAMES, type Asset } from "@/lib/assets/registry";
import { toBaseUnits, toUnits, USDC_DECIMALS } from "@/lib/units";
import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { classifyOrderError } from "@/lib/swap/errors";
import { SOL_MINT, USDC_MINT } from "@/lib/tokens";
import { getRegistry } from "@/server/assets/registry";

import { resolveAsset } from "./resolve";
import { cached } from "@/server/cache";
import { JupiterApiError } from "@/server/jupiter/client";
import { getOrder } from "@/server/jupiter/swap";
import {
  fetchAnnualGrowth,
  fetchPriceChange,
  fetchProfile,
  fetchRatiosTtm,
  fmpConfigured,
} from "@/server/market/fmp";
import { getWalletBalances as readWalletBalances } from "@/server/solana/rpc";

/**
 * Server-side tools over Orchestra's asset registry, e.g. for an assistant.
 * Every input is Zod-validated. Assets are named by ticker or token symbol
 * and resolved ONLY through the registry: no tool accepts a mint address, so
 * nothing outside the registry can be quoted or reported on.
 *
 * Every tool returns `{ data, reason }`: data, or null with the reason. A
 * missing number is null with an entry in `missing` explaining why; numbers
 * are never estimated or filled in. Market data is cached for 15 minutes;
 * quotes and balances are always live. See docs/market-tools.md.
 */

export { resolveAsset } from "./resolve";

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

// --- listAssets ---------------------------------------------------------------

export const listAssetsInput = z
  .object({
    /** Sector (or Stock / ETF when the issuer gives none), e.g. Technology. */
    sector: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

export type AssetSummary = Pick<Asset, "ticker" | "symbol" | "name" | "category" | "hours"> & {
  issuer: string | null;
};

/** The tokenized US stocks Orchestra lists (the only assets the assistant may suggest). */
export async function listAssets(input: unknown = {}): Promise<ToolResult<AssetSummary[]>> {
  const args = parse(listAssetsInput, input);
  if ("reason" in args) return fail(args.reason);
  const { sector } = args.value;
  let registry;
  try {
    registry = await getRegistry();
  } catch (error) {
    return fail(`Asset registry unavailable: ${message(error)}`);
  }
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return ok(
    registry.stocks
      .filter((a) => !sector || same(a.category, sector))
      .map((a) => ({
        ticker: a.ticker,
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        hours: a.hours,
        issuer: a.issuer ? ISSUER_NAMES[a.issuer] : null,
      })),
  );
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

async function stockMetrics(ticker: string, tokens: Asset[]): Promise<ToolResult<StockMetrics>> {
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
    name: profile.value?.companyName ?? tokens[0]?.name ?? null,
    tokens: tokens.map((t) => ({ symbol: t.symbol, issuer: ISSUER_NAMES[t.issuer!] })),
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
  let stocks: Asset[];
  try {
    stocks = (await getRegistry()).stocks;
  } catch (error) {
    return fail(`Asset registry unavailable: ${message(error)}`);
  }
  const results = await Promise.all(
    args.value.map(async (ticker): Promise<PerTicker<StockMetrics>> => {
      const wanted = ticker.replace(/^\$/, "").toUpperCase();
      // Either issuer's token (or the bare ticker) means the same company.
      const match = stocks.find(
        (s) => s.symbol.toUpperCase() === wanted || s.ticker.toUpperCase() === wanted,
      );
      if (!match)
        return {
          ticker,
          ...fail<StockMetrics>(`"${ticker}" isn't a stock in Orchestra's asset registry`),
        };
      if (!fmpConfigured()) {
        return {
          ticker,
          ...fail<StockMetrics>(
            "Stock fundamentals need MARKET_DATA_API_KEY (Financial Modeling Prep)",
          ),
        };
      }
      const tokens = stocks.filter((s) => s.ticker === match.ticker);
      return { ticker, ...(await stockMetrics(match.ticker, tokens)) };
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
  symbol: string;
  usdcIn: number;
  /** Tokens out before slippage. */
  expectedOut: number;
  /** Least tokens out after the slippage tolerance; null when Jupiter doesn't say. */
  minimumOut: number | null;
  /** Absolute price impact, percent. */
  priceImpactPct: number | null;
  /** Thin when price impact exceeds the /assets threshold. */
  thinLiquidity: boolean;
  feeBps: number | null;
  /** Signature + priority + rent fees the wallet pays, in SOL. */
  networkFeesSol: number | null;
  gasless: boolean;
  router: string;
  /** Set when Jupiter priced it but couldn't build it for this wallet (e.g. too little USDC). */
  warning: string | null;
  /** Always false: this tool only quotes. */
  executed: false;
  quotedAt: string;
};

/**
 * A live Jupiter /order quote for spending `usdcAmount` USDC on a registry
 * asset from `wallet`. Never signs, sends or returns the transaction.
 */
export async function getSwapQuote(input: unknown): Promise<ToolResult<SwapQuote>> {
  const args = parse(swapQuoteInput, input);
  if ("reason" in args) return fail(args.reason);
  const { ticker, usdcAmount, wallet } = args.value;
  let registry;
  try {
    registry = await getRegistry();
  } catch (error) {
    return fail(`Asset registry unavailable: ${message(error)}`);
  }
  const found = resolveAsset(registry.stocks, ticker);
  if ("reason" in found) return fail(found.reason);
  const { asset } = found;

  let order;
  // RFQ (JupiterZ) quotes don't check the taker's balance, so read it ourselves.
  const usdcHeld = readWalletBalances(wallet)
    .then((balances) => toUnits(balances[USDC_MINT]?.amount ?? "0", USDC_DECIMALS))
    .catch(() => null);
  try {
    order = await getOrder({
      inputMint: USDC_MINT,
      outputMint: asset.mint,
      amount: toBaseUnits(usdcAmount, USDC_DECIMALS).toString(),
      taker: wallet,
    });
  } catch (error) {
    return fail(`Jupiter couldn't quote this: ${message(error)}`);
  }
  const held = await usdcHeld;
  const impact =
    order.priceImpact === null || order.priceImpact === undefined
      ? null
      : Math.abs(order.priceImpact);
  const lamports = [
    order.signatureFeeLamports,
    order.prioritizationFeeLamports,
    order.rentFeeLamports,
  ];
  const unbuildable = order.transaction === "" ? classifyOrderError(order) : null;
  return ok({
    ticker: asset.ticker,
    symbol: asset.symbol,
    usdcIn: toUnits(order.inAmount, USDC_DECIMALS),
    expectedOut: toUnits(order.outAmount, asset.decimals),
    minimumOut: order.otherAmountThreshold
      ? toUnits(order.otherAmountThreshold, asset.decimals)
      : null,
    priceImpactPct: impact,
    thinLiquidity: impact !== null && impact > MAX_TEST_QUOTE_IMPACT_PCT,
    feeBps: order.feeBps ?? null,
    networkFeesSol: lamports.every((l) => l === null || l === undefined)
      ? null
      : lamports.reduce<number>((sum, l) => sum + (l ?? 0), 0) / 1e9,
    gasless: Boolean(order.gasless),
    router: order.router,
    warning: unbuildable
      ? `${unbuildable.title}: ${unbuildable.message}`
      : held !== null && held < usdcAmount
        ? `The wallet holds ${held} USDC, less than the ${usdcAmount} USDC quoted`
        : null,
    executed: false,
    quotedAt: new Date().toISOString(),
  });
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
export const ASSET_TOOLS = {
  listAssets: {
    description: "List the tokenized US stocks Orchestra lists, optionally by sector.",
    input: listAssetsInput,
    run: listAssets,
  },
  getStockMetrics: {
    description:
      "Market cap, P/E, revenue growth and 1M/6M/1Y returns for the companies behind registry stocks.",
    input: tickersInput,
    run: getStockMetrics,
  },
  getSwapQuote: {
    description: "A live Jupiter quote for spending USDC on a registry stock. Never executes.",
    input: swapQuoteInput,
    run: getSwapQuote,
  },
  getWalletBalances: {
    description: "A wallet's USDC and SOL balances.",
    input: walletInput,
    run: getWalletBalances,
  },
} as const;
