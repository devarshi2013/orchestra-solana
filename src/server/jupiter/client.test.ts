import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    JUPITER_API_KEY: "jup_test_key",
    JUPITER_API_BASE_URL: "https://api.jup.ag",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

import { buildJupiterUrl, JupiterApiError, jupiterFetch } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildJupiterUrl", () => {
  it("joins paths and drops undefined query values", () => {
    const url = buildJupiterUrl("https://api.jup.ag", "/swap/v2/order", {
      inputMint: "A",
      amount: 100,
      taker: undefined,
    });
    expect(url.toString()).toBe("https://api.jup.ag/swap/v2/order?inputMint=A&amount=100");
  });
});

describe("jupiterFetch", () => {
  it("sends the API key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await jupiterFetch("price/v3", {
      query: { ids: "So11111111111111111111111111111111111111112" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain("https://api.jup.ag/price/v3?ids=");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("jup_test_key");
  });

  it("throws JupiterApiError with the gateway request id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("rate limited", {
          status: 429,
          headers: { "x-api-gateway-request-id": "req-123" },
        }),
      ),
    );

    const error = await jupiterFetch("tokens/v2/search", {
      query: { query: "SOL" },
      retryRateLimit: false,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JupiterApiError);
    expect(error).toMatchObject({ status: 429, requestId: "req-123" });
  });

  it("retries a 429 after 1 s, 2 s and 4 s, then gives up", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const limited = () => new Response("Too many requests", { status: 429 });
    const fetchMock = vi.fn().mockImplementation(async () => limited());
    vi.stubGlobal("fetch", fetchMock);

    const pending = jupiterFetch("swap/v2/order").catch((e: unknown) => e);
    for (const ms of [1000, 2000, 4000]) await vi.advanceTimersByTimeAsync(ms);
    expect(await pending).toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // A 429 that clears on the second try succeeds.
    fetchMock.mockReset();
    fetchMock
      .mockImplementationOnce(async () => limited())
      .mockImplementationOnce(async () => new Response("{}", { status: 200 }));
    const retried = jupiterFetch("swap/v2/order");
    await vi.advanceTimersByTimeAsync(1000);
    expect((await retried).ok).toBe(true);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
