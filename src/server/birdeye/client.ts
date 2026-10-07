import "server-only";

import { z } from "zod";

import { serverEnv } from "@/env/server";
import type { Candle, CandleInterval } from "@/lib/market/candles";

/**
 * Birdeye Data Services: historical OHLCV for any Solana mint. The key stays
 * on the server. See docs/market-data.md for why Birdeye, plan limits and
 * compute-unit costs.
 */

const BASE_URL = "https://public-api.birdeye.so";
/** /defi/v3/ohlcv returns at most this many candles per request. */
export const MAX_CANDLES_PER_REQUEST = 5000;
/** Standard (free) plan allows 1 request/second; leave headroom. */
const MIN_REQUEST_GAP_MS = 1100;

export class BirdeyeApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Birdeye API ${status}: ${body.slice(0, 500)}`);
    this.name = "BirdeyeApiError";
  }
}

export class BirdeyeNotConfiguredError extends Error {
  constructor() {
    super("BIRDEYE_API_KEY is not set");
    this.name = "BirdeyeNotConfiguredError";
  }
}

export const ohlcvResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    items: z.array(
      z.object({
        o: z.number(),
        h: z.number(),
        l: z.number(),
        c: z.number(),
        v: z.number(),
        v_usd: z.number().nullish(),
        unix_time: z.number().int(),
      }),
    ),
  }),
});

/** Birdeye items → our candles, dropping non-positive prices (bad prints). */
export function toCandles(
  mint: string,
  interval: CandleInterval,
  response: z.infer<typeof ohlcvResponseSchema>,
): Candle[] {
  return response.data.items
    .filter((item) => item.o > 0 && item.h > 0 && item.l > 0 && item.c > 0)
    .map((item) => ({
      mint,
      interval,
      openTime: item.unix_time,
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
      volumeUsd: item.v_usd ?? null,
    }));
}

let nextRequestAt = 0;

/** Serializes requests at the plan's rate limit, process-wide. */
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = nextRequestAt - now;
  nextRequestAt = Math.max(now, nextRequestAt) + MIN_REQUEST_GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * GET /defi/v3/ohlcv in USD, candles whose open time is in [from, to]
 * (Unix seconds, inclusive). Empty candles are not padded, so a token with no
 * trades in a period simply has no candle for it.
 */
export async function fetchOhlcv(
  params: { mint: string; interval: CandleInterval; from: number; to: number },
  signal?: AbortSignal,
): Promise<Candle[]> {
  const apiKey = serverEnv.BIRDEYE_API_KEY;
  if (!apiKey) throw new BirdeyeNotConfiguredError();

  const url = new URL("/defi/v3/ohlcv", BASE_URL);
  url.searchParams.set("address", params.mint);
  url.searchParams.set("type", params.interval);
  url.searchParams.set("currency", "usd");
  url.searchParams.set("time_from", String(params.from));
  url.searchParams.set("time_to", String(params.to));

  await throttle();
  const response = await fetch(url, {
    headers: { "X-API-KEY": apiKey, "x-chain": "solana", accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new BirdeyeApiError(response.status, await response.text());

  const parsed = ohlcvResponseSchema.parse(await response.json());
  if (!parsed.success) throw new BirdeyeApiError(response.status, "success: false");
  return toCandles(params.mint, params.interval, parsed);
}
