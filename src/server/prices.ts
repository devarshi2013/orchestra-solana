import "server-only";

import { z } from "zod";

import type { PricesResponse } from "@/lib/strategies/types";
import { jupiterFetch } from "@/server/jupiter/client";

const MAX_IDS = 50;

const priceSchema = z.record(
  z.string(),
  z.object({ usdPrice: z.number(), priceChange24h: z.number().nullish() }).nullable(),
);

/** Jupiter's live USD price and 24h change (percent) for each mint; null when Jupiter has none. */
export async function livePrices(mints: readonly string[]): Promise<PricesResponse["prices"]> {
  const unique = [...new Set(mints)];
  const batches = Array.from({ length: Math.ceil(unique.length / MAX_IDS) }, (_, i) =>
    unique.slice(i * MAX_IDS, (i + 1) * MAX_IDS),
  );
  const results = await Promise.all(
    batches.map(async (ids) => {
      const response = await jupiterFetch("price/v3", { query: { ids: ids.join(",") } });
      return priceSchema.parse(await response.json());
    }),
  );
  const found = Object.assign({}, ...results) as z.infer<typeof priceSchema>;
  return Object.fromEntries(
    unique.map((mint) => {
      const entry = found[mint];
      return [
        mint,
        entry ? { price: entry.usdPrice, change24h: entry.priceChange24h ?? null } : null,
      ];
    }),
  );
}
