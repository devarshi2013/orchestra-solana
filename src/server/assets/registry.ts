import "server-only";

import { z } from "zod";

import { REGISTRY_REFRESH_MS } from "@/lib/assets/config";
import {
  curatedMints,
  indexAssets,
  jupiterTokenSchema,
  selectCrypto,
  selectStocks,
  STOCK_SOURCES,
  type Asset,
  type JupiterToken,
  type Rejection,
} from "@/lib/assets/registry";
import { jupiterFetch } from "@/server/jupiter/client";
import { paced } from "@/server/jupiter/pace";

/**
 * The live, verified registry. Built at server start (instrumentation.ts),
 * cached in memory and rebuilt every REGISTRY_REFRESH_MS. Every listed mint
 * has just been checked against Jupiter's Tokens API.
 */

export type Registry = {
  builtAt: string;
  stocks: Asset[];
  crypto: Asset[];
  rejected: Rejection[];
};

/** Mints per Tokens API batch lookup. */
const BATCH = 100;
let current: Registry | null = null;
let building: Promise<Registry> | null = null;

const tokenList = z.array(jupiterTokenSchema);

/** Tokens API batch lookup by mint. */
async function lookupMints(mints: readonly string[]): Promise<Map<string, JupiterToken>> {
  const found = new Map<string, JupiterToken>();
  for (let i = 0; i < mints.length; i += BATCH) {
    const query = mints.slice(i, i + BATCH).join(",");
    const response = await paced(() => jupiterFetch("tokens/v2/search", { query: { query } }));
    for (const token of tokenList.parse(await response.json())) found.set(token.id, token);
  }
  return found;
}

async function build(): Promise<Registry> {
  const started = Date.now();
  const stockTokens = await lookupMints(STOCK_SOURCES.map((s) => s.mint));
  const verified = tokenList.parse(
    await (
      await paced(() => jupiterFetch("tokens/v2/tag", { query: { query: "verified" } }))
    ).json(),
  );
  const curated = await lookupMints(curatedMints());
  const stocks = selectStocks(STOCK_SOURCES, stockTokens);
  const crypto = selectCrypto(verified, curated, Date.now());
  const registry: Registry = {
    builtAt: new Date().toISOString(),
    stocks: stocks.assets,
    crypto: crypto.assets,
    rejected: [...crypto.rejected, ...stocks.rejected],
  };
  const reasons = registry.rejected.reduce<Record<string, number>>((counts, r) => {
    counts[r.reason] = (counts[r.reason] ?? 0) + 1;
    return counts;
  }, {});
  console.info(
    `[assets] registry: ${registry.stocks.length} stocks, ${registry.crypto.length} crypto in ${Math.round((Date.now() - started) / 1000)}s; excluded ${JSON.stringify(reasons)}`,
  );
  if (crypto.rejected.length)
    console.warn("[assets] curated assets failed verification:", crypto.rejected);
  return registry;
}

function rebuild(): Promise<Registry> {
  building ??= build()
    .then((registry) => (current = registry))
    .finally(() => (building = null));
  return building;
}

/** Starts the first build without waiting (server start). */
export function warmRegistry(): void {
  rebuild().catch((error) => console.error("[assets] registry build failed", error));
}

/**
 * The registry, building it on first use. A stale registry is served while
 * a fresh one builds in the background.
 */
export async function getRegistry(): Promise<Registry> {
  if (!current) return rebuild();
  if (Date.now() - Date.parse(current.builtAt) > REGISTRY_REFRESH_MS) {
    rebuild().catch((error) => console.error("[assets] registry refresh failed", error));
  }
  return current;
}

/** Every mint Orchestra may hold or trade: the registry's stocks and crypto (incl. USDC). */
export async function listedAssets() {
  const registry = await getRegistry();
  return indexAssets([...registry.stocks, ...registry.crypto]);
}
