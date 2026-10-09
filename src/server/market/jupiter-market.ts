import "server-only";

import { z } from "zod";

import { mintInformationSchema } from "@/lib/jupiter/schemas";
import { MARKET_MINTS } from "@/lib/market/config";
import { cached } from "@/server/cache";
import { jupiterFetch } from "@/server/jupiter/client";

/**
 * Live prices and token stats for the home dashboard, from Jupiter's Price
 * API v3 and Tokens API v2. One request covers every dashboard token, and
 * results are cached briefly so any number of visitors costs Jupiter at most
 * one price call every few seconds (the free plan allows 1 request/second,
 * shared with swaps and the assistant).
 */

export const PRICE_TTL_MS = 4_000;
export const STATS_TTL_MS = 60_000;

const priceSchema = z.record(
  z.string(),
  z.object({ usdPrice: z.number(), priceChange24h: z.number().nullish() }).passthrough(),
);

export type LivePrice = { price: number; change24h: number | null };

/** Mint → live price; tokens Jupiter can't price reliably are left out. */
export function getLivePrices(): Promise<Record<string, LivePrice>> {
  return cached("market:prices", PRICE_TTL_MS, async () => {
    const response = await jupiterFetch("price/v3", { query: { ids: MARKET_MINTS.join(",") } });
    const parsed = priceSchema.parse(await response.json());
    return Object.fromEntries(
      Object.entries(parsed).map(([mint, p]) => [
        mint,
        { price: p.usdPrice, change24h: p.priceChange24h ?? null },
      ]),
    );
  });
}

export type TokenStats = {
  mint: string;
  symbol: string;
  name: string;
  icon: string | null;
  isVerified: boolean;
  marketCap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  holders: number | null;
};

/** Mint → logo and the stats Jupiter returns (null when it doesn't). */
export function getTokenStats(): Promise<Record<string, TokenStats>> {
  return cached("market:stats", STATS_TTL_MS, async () => {
    const response = await jupiterFetch("tokens/v2/search", {
      query: { query: MARKET_MINTS.join(",") },
    });
    const tokens = z.array(mintInformationSchema).parse(await response.json());
    return Object.fromEntries(
      tokens.map((t) => {
        const buy = t.stats24h?.buyVolume;
        const sell = t.stats24h?.sellVolume;
        return [
          t.id,
          {
            mint: t.id,
            symbol: t.symbol,
            name: t.name,
            icon: t.icon ?? null,
            isVerified: t.isVerified === true,
            marketCap: t.mcap ?? null,
            volume24h: buy == null && sell == null ? null : (buy ?? 0) + (sell ?? 0),
            liquidity: t.liquidity ?? null,
            holders: t.holderCount ?? null,
          },
        ];
      }),
    );
  });
}
