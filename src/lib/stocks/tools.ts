import "server-only";

import { z } from "zod";

import { FRIENDLY_MESSAGES, friendlyKind, type FriendlyKind } from "@/lib/friendly-error";
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
} from "@/server/market/fmp";
import { getWalletBalances as readWalletBalances } from "@/server/solana/rpc";
import { searchStocks, stockUniverse } from "@/server/stocks/universe";

import { normalizeName } from "./group";
import { ISSUERS } from "./issuers";
import type { Stock, StockToken } from "./types";

/**
 * Server-side tools over the live stock universe (src/server/stocks/universe.ts),
 * e.g. for an assistant. Every input is Zod-validated. Stocks are named by
 * company ticker or token symbol and resolved ONLY through the universe: no
 * tool accepts or returns a mint address.
 *
 * Every tool returns `{ data, reason }`: data, or null with the reason. A
 * missing number is null (with an entry in `missing` where it matters);
 * numbers are never estimated or filled in. Quotes and balances are live.
 */

export type ToolResult<T> =
  | { data: T; reason: null }
  | {
      data: null;
      reason: string;
      /** For quote and balance failures: which friendly message `reason` is. */
      kind?: FriendlyKind;
    };
const ok = <T>(data: T): ToolResult<T> => ({ data, reason: null });
const fail = (reason: string, kind?: FriendlyKind): ToolResult<never> =>
  kind ? { data: null, reason, kind } : { data: null, reason };
/** A failure from an upstream error, as one friendly sentence. */
const failWith = (error: unknown): ToolResult<never> => {
  const kind = friendlyKind(error);
  return fail(FRIENDLY_MESSAGES[kind], kind);
};

function parse<T>(schema: z.ZodType<T>, input: unknown): { value: T } | { reason: string } {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { value: parsed.data }
    : { reason: `Invalid input: ${z.prettifyError(parsed.error)}` };
}

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^\$?[A-Za-z0-9.-]+$/, "Use a ticker or token symbol, not an address");

const issuerLabel = (token: StockToken) => (token.issuer ? ISSUERS[token.issuer].label : null);

/** A company as the model sees it: market figures per token, never a mint. */
const companyView = (stock: Stock) => ({
  ticker: stock.ticker,
  name: stock.name,
  tokens: stock.tokens.map((t) => ({
    symbol: t.symbol,
    issuer: issuerLabel(t),
    priceUsd: t.price,
    change24hPct: t.change24h,
    liquidityUsd: t.liquidity,
    volume24hUsd: t.volume24h,
    holders: t.holders,
  })),
});

// --- searchStocks -------------------------------------------------------------

const searchInput = z.object({ query: z.string().trim().min(1).max(64) }).strict();

/** Most companies returned per search. */
const MAX_FOUND = 25;

/**
 * Listed companies matching `query`: an exact ticker or token symbol first,
 * then Jupiter's token search (names, symbols), most relevant first.
 */
export async function searchStocksTool(input: unknown) {
  const args = parse(searchInput, input);
  if ("reason" in args) return fail(args.reason);
  const { query } = args.value;
  try {
    const [{ byName }, found] = await Promise.all([stockUniverse(), searchStocks(query)]);
    const exact = byName.get(normalizeName(query));
    const companies = [...new Set([...(exact ? [exact] : []), ...found])];
    return ok({
      query,
      total: companies.length,
      companies: companies.slice(0, MAX_FOUND).map(companyView),
    });
  } catch (error) {
    console.error("[tools] search failed", error);
    return failWith(error);
  }
}

// --- getStockMetrics ----------------------------------------------------------

const tickersInput = z.array(nameSchema).min(1).max(20);

const MARKET_DATA_TTL_MS = 15 * 60_000;

/** Field → why it is null. */
type Missing = Record<string, string>;

export type StockMetrics = {
  /** The real company's ticker. */
  ticker: string;
  name: string | null;
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
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
};

async function stockMetrics(ticker: string): Promise<ToolResult<StockMetrics>> {
  const load = <T>(what: string, fetch: (ticker: string) => Promise<T>) =>
    settle(cached(`fmp:${what}:${ticker}`, MARKET_DATA_TTL_MS, () => fetch(ticker)));
  const [profile, change, ratios, growth] = await Promise.all([
    load("profile", fetchProfile),
    load("change", fetchPriceChange),
    load("ratios", fetchRatiosTtm),
    load("growth", fetchAnnualGrowth),
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
    if (value == null) {
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
    // The stable API names it priceToEarningsRatioTTM; older responses peRatioTTM.
    const pe = ratios.value?.priceToEarningsRatioTTM ?? ratios.value?.peRatioTTM;
    if (pe != null && pe <= 0) {
      missing.peRatio = "Negative earnings: P/E isn't meaningful";
    } else {
      peRatio = field("peRatio", pe, absent(ratios, "P/E"));
    }
    const fraction = growth.value?.revenueGrowth ?? growth.value?.growthRevenue;
    revenueGrowthPct = field(
      "revenueGrowthPct",
      fraction == null ? null : fraction * 100,
      absent(growth, "revenue growth"),
    );
  }

  return ok({
    ticker,
    name: field("name", profile.value?.companyName, absent(profile, "company name")),
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
 * Fundamentals and returns for the real companies behind listed stocks (by
 * ticker, e.g. NVDA, or token symbol, e.g. NVDAx). Offered only when
 * MARKET_DATA_API_KEY is set.
 */
export async function getStockMetrics(
  input: unknown,
): Promise<ToolResult<PerTicker<StockMetrics>[]>> {
  const args = parse(tickersInput, input);
  if ("reason" in args) return fail(args.reason);
  try {
    const { byName } = await stockUniverse();
    const results = await Promise.all(
      args.value.map(async (name): Promise<PerTicker<StockMetrics>> => {
        const stock = byName.get(normalizeName(name));
        if (!stock) return { ticker: name, ...fail(`${name} isn't a listed stock`) };
        return { ticker: name, ...(await stockMetrics(stock.ticker)) };
      }),
    );
    return ok(results);
  } catch (error) {
    console.error("[tools] metrics failed", error);
    return failWith(error);
  }
}

// --- getSwapQuote -------------------------------------------------------------

const swapQuoteInput = z
  .object({
    /** A token symbol (that token) or a company ticker (all its tokens). */
    symbol: nameSchema,
    /** USDC to spend, in whole USDC. */
    usdcAmount: z.number().finite().positive().max(1_000_000),
    /** The wallet that would swap (Jupiter sizes fees and checks balances for it). */
    wallet: base58AddressSchema,
  })
  .strict();

export type TokenQuote = {
  ticker: string;
  companyName: string;
  symbol: string;
  issuer: string | null;
  usdcIn: number;
  /** Tokens out before slippage. */
  expectedOut: number;
  /** Least tokens out after the slippage tolerance; null when Jupiter doesn't say. */
  minimumOut: number | null;
  /** Absolute price impact, percent; null when Jupiter doesn't say. */
  priceImpactPct: number | null;
  feeBps: number | null;
  /** Signature + priority + rent fees the wallet pays, in SOL; null when Jupiter doesn't say. */
  networkFeesSol: number | null;
  gasless: boolean;
  router: string;
  /** The wallet's USDC when quoted; null when it couldn't be read. */
  usdcBalance: number | null;
  /** Why this quote can't be bought as is (one friendly sentence), or null. */
  warning: string | null;
  /** Always false: this tool only quotes. */
  executed: false;
  quotedAt: string;
};

/** A token's quote with the token itself (including its mint, which never goes to the model). */
export type QuotedToken = { stock: Stock; token: StockToken; quote: TokenQuote };

/** A successful quote is reused for this long, so the same quote isn't asked for twice. */
const QUOTE_TTL_MS = 10_000;

/** The fees in SOL, or null when Jupiter left any of them out. */
const lamportsToSol = (lamports: (number | null | undefined)[]) =>
  lamports.some((l) => l == null) ? null : lamports.reduce<number>((sum, l) => sum + l!, 0) / 1e9;

async function quoteFresh(
  stock: Stock,
  token: StockToken,
  usdcAmount: number,
  wallet: string,
): Promise<ToolResult<QuotedToken>> {
  // RFQ (JupiterZ) quotes don't check the taker's balance, so read it ourselves.
  const balance = readWalletBalances(wallet).then(
    (balances) => toUnits(balances[USDC_MINT]?.amount ?? "0", USDC_DECIMALS),
    (error: unknown) => {
      console.error("[quote] balance read failed", error);
      return null;
    },
  );
  let order;
  try {
    order = await paced(() =>
      getOrder({
        inputMint: USDC_MINT,
        outputMint: token.mint,
        amount: toBaseUnits(usdcAmount, USDC_DECIMALS).toString(),
        taker: wallet,
      }),
    );
  } catch (error) {
    // JupiterApiError details are already logged by jupiterFetch.
    if (!(error instanceof JupiterApiError)) console.error(`[quote] ${token.symbol} failed`, error);
    return failWith(error);
  }
  if (!order.outAmount || order.outAmount === "0") {
    return fail(FRIENDLY_MESSAGES.no_route, "no_route");
  }
  const unbuildable = order.transaction === "" ? classifyOrderError(order) : null;
  if (unbuildable) {
    console.error(
      `[quote] ${token.symbol} unbuildable: router=${order.router} code=${order.errorCode} ${order.errorMessage ?? ""}`,
    );
  }
  const usdcBalance = await balance;
  const warning = unbuildable
    ? FRIENDLY_MESSAGES[friendlyKind(unbuildable)]
    : usdcBalance === null
      ? "Your USDC balance couldn't be read, so this can't be checked."
      : usdcBalance < usdcAmount
        ? FRIENDLY_MESSAGES.insufficient_usdc
        : null;
  return ok({
    stock,
    token,
    quote: {
      ticker: stock.ticker,
      companyName: stock.name,
      symbol: token.symbol,
      issuer: issuerLabel(token),
      usdcIn: toUnits(order.inAmount, USDC_DECIMALS),
      expectedOut: toUnits(order.outAmount, token.decimals),
      minimumOut: order.otherAmountThreshold
        ? toUnits(order.otherAmountThreshold, token.decimals)
        : null,
      priceImpactPct: order.priceImpact == null ? null : Math.abs(order.priceImpact),
      feeBps: order.feeBps ?? null,
      networkFeesSol: lamportsToSol([
        order.signatureFeeLamports,
        order.prioritizationFeeLamports,
        order.rentFeeLamports,
      ]),
      gasless: Boolean(order.gasless),
      router: order.router,
      usdcBalance,
      warning,
      executed: false,
      quotedAt: new Date().toISOString(),
    },
  });
}

const quoteCache = new Map<string, { at: number; result: Promise<ToolResult<QuotedToken>> }>();

/**
 * A live Jupiter /order quote for spending `usdcAmount` USDC on one stock
 * token (by its symbol) from `wallet`. Failures come back as one plain reason
 * (`kind` says which), never Jupiter's raw errors. Successful quotes are reused
 * for 10 s. Never signs, sends or returns a transaction.
 */
export async function quoteToken(
  symbol: string,
  usdcAmount: number,
  wallet: string,
): Promise<ToolResult<QuotedToken>> {
  let found;
  try {
    found = (await stockUniverse()).bySymbol.get(normalizeName(symbol));
  } catch (error) {
    console.error("[quote] universe failed", error);
    return failWith(error);
  }
  if (!found) return fail(`${symbol} isn't a listed stock token`);
  const key = `${found.token.mint}|${usdcAmount}|${wallet}`;
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.result;
  const result = quoteFresh(found.stock, found.token, usdcAmount, wallet);
  quoteCache.set(key, { at: Date.now(), result });
  // Only successes are reused: a failure is asked again next time.
  void result.then((r) => {
    if (!r.data) quoteCache.delete(key);
    for (const [k, v] of quoteCache) if (Date.now() - v.at >= QUOTE_TTL_MS) quoteCache.delete(k);
  });
  return result;
}

/**
 * The getSwapQuote tool. A company ticker (NVDA, MU) quotes every one of its
 * tokens, one after another, and returns them all; any other token symbol
 * (NVDAx) quotes that token. Mints are never returned.
 */
export async function getSwapQuote(input: unknown) {
  const args = parse(swapQuoteInput, input);
  if ("reason" in args) return fail(args.reason);
  const { symbol, usdcAmount, wallet } = args.value;
  let universe;
  try {
    universe = await stockUniverse();
  } catch (error) {
    console.error("[quote] universe failed", error);
    return failWith(error);
  }
  const name = normalizeName(symbol);
  // A company ticker wins over a token symbol: Backpack's tokens use the bare ticker (MU).
  const company = universe.byName.get(name);
  const tokens =
    company && normalizeName(company.ticker) === name
      ? company.tokens
      : [universe.bySymbol.get(name)?.token ?? []].flat();
  if (tokens.length === 0) return fail(`${symbol} isn't a listed stock or stock token`);
  const quotes = [];
  for (const token of tokens) {
    const result = await quoteToken(token.symbol, usdcAmount, wallet);
    quotes.push(
      result.data
        ? { symbol: token.symbol, quote: result.data.quote, reason: null }
        : { symbol: token.symbol, quote: null, reason: result.reason },
    );
  }
  return ok({ requested: symbol, quotes });
}

// --- getWalletBalances --------------------------------------------------------

export type WalletBalances = {
  wallet: string;
  /** Native SOL. */
  sol: number;
  usdc: number;
  readAt: string;
};

/** USDC and SOL held by `wallet`, read live over RPC (0 when the wallet holds none). */
export async function getWalletBalances(input: unknown): Promise<ToolResult<WalletBalances>> {
  const args = parse(base58AddressSchema, input);
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
    console.error("[wallet] balance read failed", error);
    return failWith(error);
  }
}
