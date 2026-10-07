import "server-only";

import { z } from "zod";

import { jupiterFetch } from "./client";

const MAX_IDS = 50;

const priceResponseSchema = z.record(
  z.string(),
  z
    .object({
      usdPrice: z.number(),
      priceChange24h: z.number().nullish(),
    })
    .nullable(),
);

export type PriceQuote = { usdPrice: number; priceChange24h: number | null };

/**
 * Spot prices and 24h change (percent) from Price API v3, in batches of 50.
 * Mints Jupiter can't price reliably are simply missing (docs/jupiter-api.md §3).
 */
export async function getPriceQuotes(
  mints: readonly string[],
): Promise<Record<string, PriceQuote>> {
  const unique = [...new Set(mints)];
  const prices: Record<string, PriceQuote> = {};
  for (let i = 0; i < unique.length; i += MAX_IDS) {
    const ids = unique.slice(i, i + MAX_IDS).join(",");
    const response = await jupiterFetch("price/v3", { query: { ids } });
    for (const [mint, entry] of Object.entries(priceResponseSchema.parse(await response.json()))) {
      if (entry && entry.usdPrice > 0) {
        prices[mint] = { usdPrice: entry.usdPrice, priceChange24h: entry.priceChange24h ?? null };
      }
    }
  }
  return prices;
}

/** USD price per mint (see getPriceQuotes). */
export async function getUsdPrices(mints: readonly string[]): Promise<Record<string, number>> {
  const quotes = await getPriceQuotes(mints);
  return Object.fromEntries(Object.entries(quotes).map(([mint, q]) => [mint, q.usdPrice]));
}
