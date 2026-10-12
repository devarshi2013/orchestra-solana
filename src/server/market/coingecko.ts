import "server-only";

import { z } from "zod";

import { serverEnv } from "@/env";
import type { Candle } from "@/lib/market/series";

/**
 * Price history from CoinGecko's on-chain API (GeckoTerminal's data, keyed).
 * Jupiter has no history endpoint. The Demo plan allows 30 calls a minute, so
 * calls are spaced out one at a time; Pro keys go faster. Callers cache the
 * results (src/server/stocks/history.ts). Errors, 429s included, are thrown.
 */

/** Charts are on only with both COINGECKO_API_KEY and COINGECKO_API_BASE_URL. */
export const chartsConfigured = () =>
  Boolean(serverEnv.COINGECKO_API_KEY && serverEnv.COINGECKO_API_BASE_URL);

const isPro = () => new URL(serverEnv.COINGECKO_API_BASE_URL!).hostname.startsWith("pro-api.");

class CoinGeckoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CoinGeckoError";
  }
}

type Job = { path: string; resolve: (v: unknown) => void; reject: (e: unknown) => void };
const queue: Job[] = [];
let nextSlot = 0;
let running = false;

/** One call at a time: 2.1 s apart on Demo (30/min), 0.2 s on Pro. */
async function drain() {
  if (running) return;
  running = true;
  try {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const wait = nextSlot - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      nextSlot = Date.now() + (isPro() ? 200 : 2_100);
      try {
        const response = await fetch(`${serverEnv.COINGECKO_API_BASE_URL}/onchain${job.path}`, {
          headers: {
            accept: "application/json",
            [isPro() ? "x-cg-pro-api-key" : "x-cg-demo-api-key"]: serverEnv.COINGECKO_API_KEY!,
          },
          cache: "no-store",
        });
        if (!response.ok) throw new CoinGeckoError(response.status, `CoinGecko ${response.status}`);
        job.resolve(await response.json());
      } catch (error) {
        job.reject(error);
      }
    }
  } finally {
    running = false;
  }
}

const pacedFetch = (path: string) =>
  new Promise<unknown>((resolve, reject) => {
    queue.push({ path, resolve, reject });
    void drain();
  });

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

/** An OHLCV resolution: candle size and how many candles to ask for. */
export type Resolution = {
  timeframe: "minute" | "hour" | "day";
  aggregate: number;
  limit: number;
};

/** Candles for `mint` from one pool, oldest first, priced in USD. */
export async function fetchCandles(
  pool: string,
  mint: string,
  { timeframe, aggregate, limit }: Resolution,
): Promise<Candle[]> {
  const query = new URLSearchParams({
    aggregate: String(aggregate),
    limit: String(limit),
    currency: "usd",
    token: mint,
  });
  const parsed = ohlcvSchema.parse(
    await pacedFetch(`/networks/solana/pools/${pool}/ohlcv/${timeframe}?${query}`),
  );
  return parsed.data.attributes.ohlcv_list
    .map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
    .filter((c) => [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v > 0))
    .sort((a, b) => a.time - b.time);
}

const poolsSchema = z.object({
  data: z.array(z.object({ attributes: z.object({ address: z.string() }) })),
});

/** The token's top pool (CoinGecko ranks by 24h volume and liquidity), or null when it has none. */
export async function findTopPool(mint: string): Promise<string | null> {
  const parsed = poolsSchema.parse(await pacedFetch(`/networks/solana/tokens/${mint}/pools`));
  return parsed.data[0]?.attributes.address ?? null;
}
