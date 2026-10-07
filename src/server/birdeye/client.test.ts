import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
    BIRDEYE_API_KEY: "be_test_key",
  });
});

import { BirdeyeApiError, fetchOhlcv, ohlcvResponseSchema, toCandles } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Birdeye OHLCV parsing", () => {
  // Shape from the /defi/v3/ohlcv docs example, trimmed.
  const body = {
    success: true,
    data: {
      is_scaled_ui_token: false,
      items: [
        {
          o: 128.27,
          h: 128.63,
          l: 127.91,
          c: 127.97,
          v: 58641.17,
          v_usd: 7506048,
          unix_time: 1726670700,
          address: "So11111111111111111111111111111111111111112",
          type: "1D",
          currency: "usd",
        },
        { o: 0, h: 0, l: 0, c: 0, v: 0, unix_time: 1726757100 },
        { o: 2, h: 3, l: 1, c: 2.5, v: 10, unix_time: 1726843500 },
      ],
    },
  };

  it("maps items to candles and drops zero-price prints", () => {
    const candles = toCandles("SOL", "1D", ohlcvResponseSchema.parse(body));
    expect(candles).toEqual([
      {
        mint: "SOL",
        interval: "1D",
        openTime: 1726670700,
        open: 128.27,
        high: 128.63,
        low: 127.91,
        close: 127.97,
        volume: 58641.17,
        volumeUsd: 7506048,
      },
      {
        mint: "SOL",
        interval: "1D",
        openTime: 1726843500,
        open: 2,
        high: 3,
        low: 1,
        close: 2.5,
        volume: 10,
        volumeUsd: null,
      },
    ]);
  });

  it("rejects an unexpected shape", () => {
    expect(
      ohlcvResponseSchema.safeParse({ success: true, data: { items: [{ o: "1" }] } }).success,
    ).toBe(false);
  });
});

describe("fetchOhlcv", () => {
  it("requests USD candles for the range with the key in a header", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init?: RequestInit) =>
      Response.json({ success: true, data: { items: [] } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchOhlcv({ mint: "SOL", interval: "1H", from: 100, to: 200 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      "https://public-api.birdeye.so/defi/v3/ohlcv?address=SOL&type=1H&currency=usd&time_from=100&time_to=200",
    );
    expect(init?.headers).toMatchObject({ "X-API-KEY": "be_test_key", "x-chain": "solana" });
  });

  it("throws BirdeyeApiError on HTTP errors", async () => {
    vi.stubGlobal("fetch", async () => new Response("Too many requests", { status: 429 }));
    await expect(fetchOhlcv({ mint: "SOL", interval: "1D", from: 0, to: 1 })).rejects.toThrow(
      BirdeyeApiError,
    );
  });
});
