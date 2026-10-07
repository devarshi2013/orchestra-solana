import "server-only";

import { z } from "zod";

import { INTERVAL_SECONDS, type Candle, type CandleInterval } from "@/lib/market/candles";

/**
 * GeckoTerminal public API (CoinGecko onchain): keyless DEX-pool OHLCV, the
 * default history source. Candles come from one pool per token, picked once
 * and saved (see pickPricePool). See docs/market-data.md for its limits.
 */

const BASE_URL = "https://api.geckoterminal.com/api/v2/networks/solana";
/** OHLCV `limit` maximum. */
export const MAX_CANDLES_PER_REQUEST = 1000;
/** The keyless API rejects requests reaching further back than this. */
export const HISTORY_DAYS = 180;
/**
 * The keyless limit is per IP, unpublished and shared with anything else on
 * the same IP; failed requests count too. Pace at ~10 calls/minute and back
 * off on 429. Mutable only so tests can skip the waiting.
 */
export const rateLimit = {
  minGapMs: 6000,
  backoffMs: [10_000, 20_000, 40_000],
};

const TIMEFRAME: Record<CandleInterval, string> = { "1D": "day", "1H": "hour" };

export class GeckoTerminalApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`GeckoTerminal API ${status}: ${body.slice(0, 500)}`);
    this.name = "GeckoTerminalApiError";
  }
}

export const poolsResponseSchema = z.object({
  data: z.array(
    z.object({
      attributes: z.object({
        address: z.string(),
        pool_created_at: z.string().nullish(),
        volume_usd: z.object({ h24: z.coerce.number().nullish() }).nullish(),
      }),
    }),
  ),
});

export const ohlcvResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      /** [timestamp, open, high, low, close, volume (USD)], newest first. */
      ohlcv_list: z.array(
        z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]),
      ),
    }),
  }),
});

/**
 * The pool to price a token from: the highest 24h USD volume among pools old
 * enough to cover the full keyless history window, or among all pools when the
 * token is newer than that. Volume, not `reserve_in_usd`: spoofed pools report
 * billions in reserves while barely trading, and would feed fake prices.
 */
export function pickPricePool(
  response: z.infer<typeof poolsResponseSchema>,
  now: number = Date.now(),
): string | null {
  const pools = response.data.map(({ attributes }) => ({
    address: attributes.address,
    volume: attributes.volume_usd?.h24 ?? 0,
    createdAt: Date.parse(attributes.pool_created_at ?? ""),
  }));
  const cutoff = now - HISTORY_DAYS * 86_400_000;
  const mature = pools.filter((pool) => pool.createdAt <= cutoff);
  const candidates = mature.length > 0 ? mature : pools;
  let best: (typeof pools)[number] | null = null;
  for (const pool of candidates) if (!best || pool.volume > best.volume) best = pool;
  return best?.address ?? null;
}

/** GeckoTerminal rows → our candles, oldest first, dropping non-positive prices. */
export function toCandles(
  mint: string,
  interval: CandleInterval,
  response: z.infer<typeof ohlcvResponseSchema>,
): Candle[] {
  return response.data.attributes.ohlcv_list
    .filter(([, o, h, l, c]) => o > 0 && h > 0 && l > 0 && c > 0)
    .map(([time, open, high, low, close, volumeUsd]) => ({
      mint,
      interval,
      openTime: time,
      open,
      high,
      low,
      close,
      volume: null,
      volumeUsd,
    }))
    .sort((a, b) => a.openTime - b.openTime);
}

let nextRequestAt = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = nextRequestAt - now;
  nextRequestAt = Math.max(now, nextRequestAt) + rateLimit.minGapMs;
  if (wait > 0) await sleep(wait);
}

/** GET with pacing, retrying 429s after each `rateLimit.backoffMs` delay. */
async function getJson(url: URL, signal?: AbortSignal): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal,
      cache: "no-store",
    });
    if (response.ok) return response.json();
    const backoff = rateLimit.backoffMs[attempt];
    if (response.status !== 429 || backoff === undefined) {
      throw new GeckoTerminalApiError(response.status, await response.text());
    }
    await sleep(backoff);
  }
}

/** The pool `pickPricePool` chooses for `mint`; throws if GeckoTerminal lists none. */
export async function findPricePool(mint: string, signal?: AbortSignal): Promise<string> {
  const url = new URL(`${BASE_URL}/tokens/${mint}/pools`);
  url.searchParams.set("page", "1");
  const pool = pickPricePool(poolsResponseSchema.parse(await getJson(url, signal)));
  if (!pool) throw new GeckoTerminalApiError(404, `No pool found for ${mint}`);
  return pool;
}

/**
 * USD candles of `mint` (priced in that pool) whose open time is in
 * [from, to]. Periods without swaps have no candle.
 */
export async function fetchPoolOhlcv(
  params: { mint: string; pool: string; interval: CandleInterval; from: number; to: number },
  signal?: AbortSignal,
): Promise<Candle[]> {
  const width = INTERVAL_SECONDS[params.interval];
  const count = Math.floor((params.to - params.from) / width) + 1;
  const url = new URL(`${BASE_URL}/pools/${params.pool}/ohlcv/${TIMEFRAME[params.interval]}`);
  url.searchParams.set("aggregate", "1");
  url.searchParams.set("currency", "usd");
  url.searchParams.set("token", params.mint);
  url.searchParams.set("before_timestamp", String(params.to + width));
  url.searchParams.set("limit", String(Math.min(count, MAX_CANDLES_PER_REQUEST)));

  const candles = toCandles(
    params.mint,
    params.interval,
    ohlcvResponseSchema.parse(await getJson(url, signal)),
  );
  return candles.filter((c) => c.openTime >= params.from && c.openTime <= params.to);
}
