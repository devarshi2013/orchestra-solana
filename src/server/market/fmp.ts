import "server-only";

import { z } from "zod";

import { serverEnv } from "@/env/server";

/**
 * Financial Modeling Prep "stable" API: company fundamentals and returns for
 * the real, underlying company. Key: MARKET_DATA_API_KEY (docs/market-tools.md).
 */

const BASE_URL = "https://financialmodelingprep.com/stable";

export class FmpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FmpError";
  }
}

export const fmpConfigured = () => Boolean(serverEnv.MARKET_DATA_API_KEY);

async function fmpGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("apikey", serverEnv.MARKET_DATA_API_KEY ?? "");
  const response = await fetch(url, { cache: "no-store" });
  const body: unknown = await response.json().catch(() => null);
  const message = (body as { "Error Message"?: string } | null)?.["Error Message"];
  if (!response.ok || message) {
    throw new FmpError(response.status, message ?? `Financial Modeling Prep ${response.status}`);
  }
  return body;
}

const num = z.number().finite().nullish();

export const profileSchema = z.array(
  z.object({
    symbol: z.string(),
    companyName: z.string().nullish(),
    marketCap: num,
    isEtf: z.boolean().nullish(),
    isFund: z.boolean().nullish(),
  }),
);
/** Percent changes over each period (12.3 = +12.3%). */
export const priceChangeSchema = z.array(
  z.object({ symbol: z.string(), "1M": num, "6M": num, "1Y": num }),
);
/** The stable API names it priceToEarningsRatioTTM; older responses used peRatioTTM. */
export const ratiosTtmSchema = z.array(z.object({ priceToEarningsRatioTTM: num, peRatioTTM: num }));
/** Growth as a fraction (0.08 = 8%); stable uses revenueGrowth, some versions growthRevenue. */
export const growthSchema = z.array(
  z.object({ date: z.string().nullish(), revenueGrowth: num, growthRevenue: num }),
);

export async function fetchProfile(symbol: string) {
  return profileSchema.parse(await fmpGet("profile", { symbol }))[0] ?? null;
}
export async function fetchPriceChange(symbol: string) {
  return priceChangeSchema.parse(await fmpGet("stock-price-change", { symbol }))[0] ?? null;
}
export async function fetchRatiosTtm(symbol: string) {
  return ratiosTtmSchema.parse(await fmpGet("ratios-ttm", { symbol }))[0] ?? null;
}
export async function fetchAnnualGrowth(symbol: string) {
  return (
    growthSchema.parse(
      await fmpGet("financial-growth", { symbol, period: "annual", limit: "1" }),
    )[0] ?? null
  );
}

/** Market cap for many symbols in one call (comma-separated). Not on every FMP plan. */
export const batchQuoteSchema = z.array(z.object({ symbol: z.string(), marketCap: num }));
export async function fetchBatchQuotes(symbols: string[]) {
  return batchQuoteSchema.parse(await fmpGet("batch-quote", { symbols: symbols.join(",") }));
}
/** 1Y returns for many symbols in one call. Not on every FMP plan. */
export async function fetchBatchPriceChange(symbols: string[]) {
  return priceChangeSchema.parse(await fmpGet("stock-price-change", { symbol: symbols.join(",") }));
}
