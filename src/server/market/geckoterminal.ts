import "server-only";

import { z } from "zod";

import type { Candle } from "@/lib/market/series";
import type { WindowSpec } from "@/lib/market/config";

/**
 * Price history from GeckoTerminal's public API (no key, roughly 30 requests
 * per minute per IP, and stricter after bursts). Jupiter has no history
 * endpoint (docs/home-dashboard.md). Calls are spaced out one at a time, and
 * callers cache the results (src/server/market/history.ts).
 */

const BASE = "https://api.geckoterminal.com/api/v2/networks/solana";
/** Minimum gap between GeckoTerminal calls from this server. */
const GAP_MS = 2_200;

export class GeckoTerminalError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeckoTerminalError";
  }
}

let nextSlot = 0;
async function pacedFetch(url: string, signal?: AbortSignal): Promise<unknown> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const response = await fetch(url, {
    headers: { accept: "application/json;version=20230302" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 429) nextSlot = Date.now() + 15_000; // back off for everyone
    throw new GeckoTerminalError(response.status, `GeckoTerminal ${response.status}`);
  }
  return response.json();
}

const ohlcvSchema = z.object({
  data: z.object({
    attributes: z.object({
      // [unix seconds, open, high, low, close, volume], newest first
      ohlcv_list: z.array(
        z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]),
      ),
    }),
  }),
});

/** Candles for `mint` from one pool, oldest first, priced in USD. */
export async function fetchCandles(
  pool: string,
  mint: string,
  window: WindowSpec,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const url = `${BASE}/pools/${pool}/ohlcv/${window.timeframe}?aggregate=${window.aggregate}&limit=${window.limit}&currency=usd&token=${mint}`;
  const parsed = ohlcvSchema.parse(await pacedFetch(url, signal));
  return parsed.data.attributes.ohlcv_list
    .map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
    .filter((c) => [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v > 0))
    .sort((a, b) => a.time - b.time);
}

const poolsSchema = z.object({
  data: z.array(
    z.object({
      attributes: z.object({
        address: z.string(),
        pool_created_at: z.string().nullish(),
        volume_usd: z.object({ h24: z.string().nullish() }).partial(),
      }),
    }),
  ),
});

/** The token's busiest pool by 24h volume that is at least 30 days old. */
export async function findTopPool(mint: string, signal?: AbortSignal): Promise<string | null> {
  const parsed = poolsSchema.parse(await pacedFetch(`${BASE}/tokens/${mint}/pools?page=1`, signal));
  const monthAgo = Date.now() - 30 * 86_400_000;
  const pools = parsed.data
    .map((p) => ({
      address: p.attributes.address,
      created: p.attributes.pool_created_at ? Date.parse(p.attributes.pool_created_at) : 0,
      volume: Number(p.attributes.volume_usd.h24 ?? 0),
    }))
    .filter((p) => p.created > 0 && p.created < monthAgo)
    .sort((a, b) => b.volume - a.volume);
  return pools[0]?.address ?? null;
}
