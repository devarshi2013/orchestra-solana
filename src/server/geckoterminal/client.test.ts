import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPoolOhlcv,
  findPricePool,
  GeckoTerminalApiError,
  ohlcvResponseSchema,
  pickPricePool,
  poolsResponseSchema,
  rateLimit,
  toCandles,
} from "./client";

rateLimit.minGapMs = 0;
rateLimit.backoffMs = [1, 1];

afterEach(() => {
  vi.unstubAllGlobals();
});

const OLD = "2024-01-01T00:00:00Z";
const NOW = Date.parse("2026-10-07T00:00:00Z");
const pools = (...specs: { volume: string | null; created?: string | null }[]) => ({
  data: specs.map(({ volume, created = OLD }, i) => ({
    id: `solana_pool${i}`,
    type: "pool",
    attributes: {
      address: `pool${i}`,
      reserve_in_usd: "8110539329", // ignored: easily spoofed
      pool_created_at: created,
      volume_usd: { h24: volume },
    },
  })),
});

// Shape from a live /pools/{pool}/ohlcv/day response, trimmed.
const ohlcv = (rows: number[][]) => ({
  data: { id: "x", type: "ohlcv_request_response", attributes: { ohlcv_list: rows } },
  meta: { base: { symbol: "SOL" } },
});

describe("pickPricePool", () => {
  const pick = (...specs: Parameters<typeof pools>) =>
    pickPricePool(poolsResponseSchema.parse(pools(...specs)), NOW);

  it("picks the highest 24h volume among pools older than the history window", () => {
    expect(pick({ volume: "10.5" }, { volume: "9000.1" }, { volume: null })).toBe("pool1");
    // A busier pool created last week would leave most of the window empty.
    expect(pick({ volume: "100" }, { volume: "1e9", created: "2026-10-01T00:00:00Z" })).toBe(
      "pool0",
    );
  });

  it("falls back to every pool when the token is newer than the window", () => {
    expect(
      pick({ volume: "5", created: "2026-10-01T00:00:00Z" }, { volume: "50", created: null }),
    ).toBe("pool1");
  });

  it("is null when the token has no pools", () => {
    expect(pick()).toBeNull();
  });
});

describe("toCandles", () => {
  it("maps rows oldest first with USD volume, dropping zero prices", () => {
    const parsed = ohlcvResponseSchema.parse(
      ohlcv([
        [200, 2, 3, 1, 2.5, 1000],
        [100, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 50],
      ]),
    );
    expect(toCandles("SOL", "1D", parsed)).toEqual([
      {
        mint: "SOL",
        interval: "1D",
        openTime: 0,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: null,
        volumeUsd: 50,
      },
      {
        mint: "SOL",
        interval: "1D",
        openTime: 200,
        open: 2,
        high: 3,
        low: 1,
        close: 2.5,
        volume: null,
        volumeUsd: 1000,
      },
    ]);
  });
});

describe("requests", () => {
  it("finds the price pool for a mint", async () => {
    const fetchMock = vi.fn(async (_url: URL) =>
      Response.json(pools({ volume: "1" }, { volume: "5" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await findPricePool("MINT")).toBe("pool1");
    expect(fetchMock.mock.calls[0]![0].toString()).toBe(
      "https://api.geckoterminal.com/api/v2/networks/solana/tokens/MINT/pools?page=1",
    );
  });

  it("throws when a token has no pool", async () => {
    vi.stubGlobal("fetch", async () => Response.json(pools()));
    await expect(findPricePool("MINT")).rejects.toThrow("No pool found for MINT");
  });

  it("asks for the range ending at `to`, priced in the token, and trims to [from, to]", async () => {
    const H = 3600;
    const fetchMock = vi.fn(async (_url: URL) =>
      Response.json(
        ohlcv([
          [4 * H, 1, 1, 1, 1, 0], // after `to`
          [3 * H, 1, 1, 1, 1, 0],
          [2 * H, 1, 1, 1, 1, 0],
          [1 * H, 1, 1, 1, 1, 0], // before `from`
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const candles = await fetchPoolOhlcv({
      mint: "MINT",
      pool: "POOL",
      interval: "1H",
      from: 2 * H,
      to: 3 * H,
    });

    expect(candles.map((c) => c.openTime)).toEqual([2 * H, 3 * H]);
    expect(fetchMock.mock.calls[0]![0].toString()).toBe(
      `https://api.geckoterminal.com/api/v2/networks/solana/pools/POOL/ohlcv/hour?aggregate=1&currency=usd&token=MINT&before_timestamp=${4 * H}&limit=2`,
    );
  });

  it("retries rate-limited requests, then gives up", async () => {
    const limited = () => new Response("rate limited", { status: 429 });
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(limited())
      .mockResolvedValueOnce(Response.json(pools({ volume: "1" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findPricePool("MINT")).toBe("pool0");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const alwaysLimited = vi.fn(async () => limited());
    vi.stubGlobal("fetch", alwaysLimited);
    await expect(findPricePool("MINT")).rejects.toThrow("GeckoTerminal API 429");
    expect(alwaysLimited).toHaveBeenCalledTimes(3); // first try + 2 retries
  });

  it("throws GeckoTerminalApiError on HTTP errors", async () => {
    vi.stubGlobal("fetch", async () => new Response("past 180 days only", { status: 401 }));
    await expect(
      fetchPoolOhlcv({ mint: "M", pool: "P", interval: "1D", from: 0, to: 0 }),
    ).rejects.toThrow(GeckoTerminalApiError);
  });
});
