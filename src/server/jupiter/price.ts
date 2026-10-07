import "server-only";

import { z } from "zod";

import { jupiterFetch } from "./client";

const MAX_IDS = 50;

const priceResponseSchema = z.record(
  z.string(),
  z.object({ usdPrice: z.number(), decimals: z.number().nullish() }).nullable(),
);

/**
 * Spot USD prices from Price API v3, in batches of 50. Mints Jupiter can't
 * price reliably are simply missing from the result (docs/jupiter-api.md §3).
 */
export async function getUsdPrices(mints: readonly string[]): Promise<Record<string, number>> {
  const unique = [...new Set(mints)];
  const prices: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += MAX_IDS) {
    const ids = unique.slice(i, i + MAX_IDS).join(",");
    const response = await jupiterFetch("price/v3", { query: { ids } });
    for (const [mint, entry] of Object.entries(priceResponseSchema.parse(await response.json()))) {
      if (entry && entry.usdPrice > 0) prices[mint] = entry.usdPrice;
    }
  }
  return prices;
}
