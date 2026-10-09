import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
    MARKET_DATA_API_KEY: "fmp_test_key",
  });
});

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
