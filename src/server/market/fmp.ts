import "server-only";

import { z } from "zod";

import { serverEnv } from "@/env";

/**
 * Financial Modeling Prep "stable" API: company fundamentals and returns for
 * the real, underlying company. Key: MARKET_DATA_API_KEY.
 */

const BASE_URL = "https://financialmodelingprep.com/stable";

class FmpError extends Error {
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
  const apikey = serverEnv.MARKET_DATA_API_KEY;
  if (!apikey) throw new FmpError(0, "MARKET_DATA_API_KEY is not set");
  const query = new URLSearchParams({ ...params, apikey });
  const response = await fetch(new URL(`${BASE_URL}/${path}?${query}`), { cache: "no-store" });
  const body: unknown = await response.json().catch(() => null);
  const message = (body as { "Error Message"?: string } | null)?.["Error Message"];
  if (!response.ok || message) {
    throw new FmpError(response.status, message ?? `Financial Modeling Prep ${response.status}`);
  }
  return body;
}

const num = z.number().finite().nullish();

const profileSchema = z.array(
  z.object({
    symbol: z.string(),
    companyName: z.string().nullish(),
    marketCap: num,
    isEtf: z.boolean().nullish(),
    isFund: z.boolean().nullish(),
  }),
);
/** Percent changes over each period (12.3 = +12.3%). */
const priceChangeSchema = z.array(
  z.object({ symbol: z.string(), "1M": num, "6M": num, "1Y": num }),
);
/** The stable API names it priceToEarningsRatioTTM; older responses used peRatioTTM. */
const ratiosTtmSchema = z.array(z.object({ priceToEarningsRatioTTM: num, peRatioTTM: num }));
/** Growth as a fraction (0.08 = 8%); stable uses revenueGrowth, some versions growthRevenue. */
const growthSchema = z.array(
  z.object({ date: z.string().nullish(), revenueGrowth: num, growthRevenue: num }),
);

/** The first row of a single-symbol endpoint, or null when FMP returns none. */
const first = async <T>(schema: z.ZodType<T[]>, path: string, params: Record<string, string>) =>
  schema.parse(await fmpGet(path, params))[0] ?? null;

export const fetchProfile = (symbol: string) => first(profileSchema, "profile", { symbol });
export const fetchPriceChange = (symbol: string) =>
  first(priceChangeSchema, "stock-price-change", { symbol });
export const fetchRatiosTtm = (symbol: string) => first(ratiosTtmSchema, "ratios-ttm", { symbol });
export const fetchAnnualGrowth = (symbol: string) =>
  first(growthSchema, "financial-growth", { symbol, period: "annual", limit: "1" });
