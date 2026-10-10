import "server-only";

import { z } from "zod";

import type { Candle } from "@/lib/market/series";
import type { WindowSpec } from "@/lib/market/config";

/**
 * Price history from GeckoTerminal's public API (no key, roughly 30 requests
 * per minute per IP, and stricter after bursts). Jupiter has no history
 * endpoint. Calls are spaced out one at a time, and
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

/** "now": something a person is waiting on (a stock page's chart); it goes ahead of background loads. */
export type Priority = "now" | "background";

type Job = {
  url: string;
  signal?: AbortSignal;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};
const queues: Record<Priority, Job[]> = { now: [], background: [] };
let nextSlot = 0;
let running = false;

/** One call at a time, GAP_MS apart; "now" jobs are taken before background ones. */
async function drain() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = queues.now.shift() ?? queues.background.shift();
      if (!job) return;
      if (job.signal?.aborted) {
        job.reject(job.signal.reason);
        continue;
      }
      const wait = nextSlot - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      nextSlot = Date.now() + GAP_MS;
      try {
        const response = await fetch(job.url, {
          headers: { accept: "application/json;version=20230302" },
          signal: job.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          if (response.status === 429) nextSlot = Date.now() + 15_000; // back off for everyone
          throw new GeckoTerminalError(response.status, `GeckoTerminal ${response.status}`);
        }
        job.resolve(await response.json());
      } catch (error) {
        job.reject(error);
      }
    }
  } finally {
    running = false;
  }
}

function pacedFetch(
  url: string,
  signal?: AbortSignal,
  priority: Priority = "background",
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    queues[priority].push({ url, signal, resolve, reject });
    void drain();
  });
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
  priority?: Priority,
): Promise<Candle[]> {
  const url = `${BASE}/pools/${pool}/ohlcv/${window.timeframe}?aggregate=${window.aggregate}&limit=${window.limit}&currency=usd&token=${mint}`;
  const parsed = ohlcvSchema.parse(await pacedFetch(url, signal, priority));
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
export async function findTopPool(
  mint: string,
  signal?: AbortSignal,
  priority?: Priority,
): Promise<string | null> {
  const parsed = poolsSchema.parse(
    await pacedFetch(`${BASE}/tokens/${mint}/pools?page=1`, signal, priority),
  );
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

const multiSchema = z.object({
  data: z.array(
    z.object({
      attributes: z.object({ address: z.string() }),
      relationships: z
        .object({ top_pools: z.object({ data: z.array(z.object({ id: z.string() })) }).partial() })
        .partial(),
    }),
  ),
});

/** GeckoTerminal answers for at most this many tokens per call. */
export const MAX_TOKENS_PER_LOOKUP = 30;

/** The top pool of up to 30 tokens in one call (mint → pool address, or null when it has none). */
export async function findTopPools(
  mints: readonly string[],
  signal?: AbortSignal,
): Promise<Record<string, string | null>> {
  const parsed = multiSchema.parse(
    await pacedFetch(`${BASE}/tokens/multi/${mints.join(",")}`, signal),
  );
  const pools: Record<string, string | null> = Object.fromEntries(mints.map((m) => [m, null]));
  for (const token of parsed.data) {
    const id = token.relationships?.top_pools?.data?.[0]?.id;
    pools[token.attributes.address] = id ? id.replace(/^solana_/, "") : null;
  }
  return pools;
}
