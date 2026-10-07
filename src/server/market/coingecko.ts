import "server-only";

import { z } from "zod";

import { serverEnv } from "@/env/server";

/**
 * CoinGecko daily price history by Solana mint (contract address), for
 * returns and volatility. Keyless works; COINGECKO_API_KEY (Demo) raises the
 * rate limit. Public/Demo history is capped at the last 365 days.
 */

const BASE_URL = "https://api.coingecko.com/api/v3";

export class CoinGeckoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CoinGeckoError";
  }
}

const chartSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])),
});

/**
 * [unix ms, USD] points for the last `days` days, daily (the final point is
 * the latest price). null when CoinGecko doesn't list the token.
 */
export async function fetchDailyPrices(
  mint: string,
  days = 365,
): Promise<[number, number][] | null> {
  const url = new URL(`${BASE_URL}/coins/solana/contract/${mint}/market_chart`);
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("days", String(days));
  url.searchParams.set("interval", "daily");
  const headers: Record<string, string> = { accept: "application/json" };
  if (serverEnv.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = serverEnv.COINGECKO_API_KEY;
  const response = await fetch(url, { headers, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new CoinGeckoError(response.status, `CoinGecko ${response.status}`);
  return chartSchema.parse(await response.json()).prices;
}
