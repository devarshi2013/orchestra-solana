import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
    MARKET_DATA_API_KEY: "fmp_test_key",
    COINGECKO_API_KEY: "cg_test_key",
  });
});

import { CoinGeckoError, fetchDailyPrices } from "./coingecko";
import { fetchAnnualGrowth, fetchPriceChange, fetchProfile, FmpError } from "./fmp";

afterEach(() => vi.unstubAllGlobals());

describe("Financial Modeling Prep", () => {
  it("requests stable endpoints with the key and parses the first row", async () => {
    const fetchMock = vi.fn(async (_url: URL) =>
      Response.json([
        { symbol: "NVDA", companyName: "NVIDIA", marketCap: 4e12, isEtf: false, extra: 1 },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchProfile("NVDA")).toEqual({
      symbol: "NVDA",
      companyName: "NVIDIA",
      marketCap: 4e12,
      isEtf: false,
    });
    expect(fetchMock.mock.calls[0]![0].toString()).toBe(
      "https://financialmodelingprep.com/stable/profile?symbol=NVDA&apikey=fmp_test_key",
    );
  });

  it("asks for the latest annual growth and returns null for an empty list", async () => {
    const fetchMock = vi.fn(async (_url: URL) => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchAnnualGrowth("NVDA")).toBeNull();
    expect(fetchMock.mock.calls[0]![0].searchParams.get("period")).toBe("annual");
    expect(fetchMock.mock.calls[0]![0].searchParams.get("limit")).toBe("1");
  });

  it("turns FMP's error bodies into FmpError", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ "Error Message": "Invalid API KEY." }, { status: 401 }),
    );
    await expect(fetchPriceChange("NVDA")).rejects.toThrow(FmpError);
    vi.stubGlobal("fetch", async () => Response.json({ "Error Message": "Limit Reach" }));
    await expect(fetchPriceChange("NVDA")).rejects.toThrow("Limit Reach");
  });
});

describe("CoinGecko", () => {
  it("fetches a year of daily prices by Solana mint with the Demo key", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init?: RequestInit) =>
      Response.json({
        prices: [
          [1, 2],
          [3, 4],
        ],
        market_caps: [],
        total_volumes: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchDailyPrices("MINT")).toEqual([
      [1, 2],
      [3, 4],
    ]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      "https://api.coingecko.com/api/v3/coins/solana/contract/MINT/market_chart?vs_currency=usd&days=365&interval=daily",
    );
    expect(init?.headers).toMatchObject({ "x-cg-demo-api-key": "cg_test_key" });
  });

  it("is null for tokens CoinGecko doesn't list and throws on other errors", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 404 }));
    expect(await fetchDailyPrices("MINT")).toBeNull();
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 429 }));
    await expect(fetchDailyPrices("MINT")).rejects.toThrow(CoinGeckoError);
  });
});
