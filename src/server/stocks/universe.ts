import "server-only";

import { z } from "zod";

import { mintInformationSchema } from "@/lib/jupiter/schemas";
import {
  groupStocks,
  indexStocks,
  isStockToken,
  toStockToken,
  type StockIndex,
} from "@/lib/stocks/group";
import type { Stock, StockToken } from "@/lib/stocks/types";
import { cached } from "@/server/cache";
import { jupiterFetch } from "@/server/jupiter/client";

/**
 * The stock universe, read live from Jupiter: every verified token tagged
 * `stocks`, from any issuer, grouped by company. Nothing is hardcoded and
 * nothing is kept when Jupiter can't be read: callers get the error.
 */

const UNIVERSE_TTL_MS = 60_000;
const mintsSchema = z.array(mintInformationSchema);

async function verifiedStockTokens(): Promise<StockToken[]> {
  const response = await jupiterFetch("tokens/v2/tag", { query: { query: "verified" } });
  return mintsSchema
    .parse(await response.json())
    .filter(isStockToken)
    .map(toStockToken);
}

export type Universe = StockIndex & { asOf: string };

export const stockUniverse = (): Promise<Universe> =>
  cached("stocks:universe", UNIVERSE_TTL_MS, async () => ({
    ...indexStocks(groupStocks(await verifiedStockTokens())),
    asOf: new Date().toISOString(),
  }));

/** The stock token with this mint, or null when the mint isn't a listed stock token. */
export async function findStockToken(mint: string) {
  return (await stockUniverse()).byMint.get(mint) ?? null;
}

/**
 * Jupiter's token search (symbol, name or mint), kept to stock tokens and
 * returned as companies from the universe, in Jupiter's relevance order.
 */
export async function searchStocks(query: string): Promise<Stock[]> {
  const response = await jupiterFetch("tokens/v2/search", { query: { query } });
  const found = mintsSchema.parse(await response.json()).filter(isStockToken);
  const { byMint } = await stockUniverse();
  return [...new Set(found.flatMap((mint) => byMint.get(mint.id)?.stock ?? []))];
}
