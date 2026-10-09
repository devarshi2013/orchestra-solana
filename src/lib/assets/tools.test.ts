import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

const mocks = vi.hoisted(() => ({
  getRegistry: vi.fn(),
  fmpConfigured: vi.fn(() => true),
  fetchProfile: vi.fn(),
  fetchPriceChange: vi.fn(),
  fetchRatiosTtm: vi.fn(),
  fetchAnnualGrowth: vi.fn(),
  jupiterFetch: vi.fn(),
  getOrder: vi.fn(),
  getWalletBalances: vi.fn(),
}));

vi.mock("@/server/assets/registry", () => ({ getRegistry: mocks.getRegistry }));
vi.mock("@/server/market/fmp", () => ({
  fmpConfigured: mocks.fmpConfigured,
  fetchProfile: mocks.fetchProfile,
  fetchPriceChange: mocks.fetchPriceChange,
  fetchRatiosTtm: mocks.fetchRatiosTtm,
  fetchAnnualGrowth: mocks.fetchAnnualGrowth,
}));
vi.mock("@/server/jupiter/client", async (importOriginal) => ({
  ...(await importOriginal<typeof JupiterClient>()),
  jupiterFetch: mocks.jupiterFetch,
}));
vi.mock("@/server/jupiter/swap", () => ({ getOrder: mocks.getOrder }));
vi.mock("@/server/solana/rpc", () => ({ getWalletBalances: mocks.getWalletBalances }));

import type { Asset } from "@/lib/assets/registry";
import type * as JupiterClient from "@/server/jupiter/client";
import { SOL_MINT, USDC_MINT } from "@/lib/tokens";
import { clearCache } from "@/server/cache";
import { JupiterApiError } from "@/server/jupiter/client";

import {
  getStockMetrics,
  getSwapQuote,
  getWalletBalances,
  listAssets,
  resolveAsset,
} from "./tools";

const WALLET = "2bQ6SPX7mz5DHa7hunC9L1QUdGuHpLuKBNKA11MkFSeQ";
const asset = (overrides: Partial<Asset>): Asset => ({
  kind: "crypto",
  ticker: "X",
  name: "X",
  category: "Other",
  mint: "Mint1111111111111111111111111111111111111111",
  symbol: "X",
  decimals: 6,
  icon: null,
  liquidityUsd: 1_000_000,
  volume24hUsd: 1_000_000,
  ...overrides,
});
const NVDAX = asset({
  kind: "stock",
  ticker: "NVDA",
  symbol: "NVDAx",
  name: "NVIDIA",
  category: "Stock",
  issuer: "xstocks",
  hours: "24/5",
  mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  decimals: 8,
});
const NVDAON = asset({
  kind: "stock",
  ticker: "NVDA",
  symbol: "NVDAon",
  name: "NVIDIA",
  category: "Stock",
  issuer: "ondo",
  hours: "24/5",
  mint: "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo",
  decimals: 9,
});
const SPYX = asset({
  kind: "stock",
  ticker: "SPY",
  symbol: "SPYx",
  name: "SP500",
  category: "ETF",
  issuer: "xstocks",
  hours: "24/5",
  mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  decimals: 8,
});
const SOL = asset({
  ticker: "SOL",
  symbol: "SOL",
  name: "Solana",
  category: "Major",
  mint: SOL_MINT,
  decimals: 9,
});
const JUP = asset({
  ticker: "JUP",
  symbol: "JUP",
  name: "Jupiter",
  category: "DeFi",
  mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
});
const USDC = asset({
  ticker: "USDC",
  symbol: "USDC",
  name: "USD Coin",
  category: "Cash",
  mint: USDC_MINT,
  cash: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  clearCache();
  mocks.fmpConfigured.mockReturnValue(true);
  mocks.getRegistry.mockResolvedValue({
    builtAt: "2026-10-07T00:00:00Z",
    stocks: [NVDAX, NVDAON, SPYX],
    crypto: [SOL, JUP, USDC],
    rejected: [],
  });
});

describe("resolveAsset", () => {
  const all = [NVDAX, NVDAON, SPYX, SOL, USDC];
  it("prefers exact token symbols and flags tickers shared by two issuers", () => {
    expect(resolveAsset(all, "nvdax")).toEqual({ asset: NVDAX });
    expect(resolveAsset(all, "SPY")).toEqual({ asset: SPYX });
    expect(resolveAsset(all, "$SOL")).toEqual({ asset: SOL });
    expect(resolveAsset(all, "NVDA")).toEqual({
      reason: '"NVDA" matches NVDAx and NVDAon; use the token symbol',
    });
    expect(resolveAsset(all, "DOGE")).toEqual({
      reason: `"DOGE" isn't in Orchestra's asset registry`,
    });
  });
});

describe("listAssets", () => {
  it("lists only the tokenized stocks, optionally by sector", async () => {
    expect((await listAssets()).data?.map((a) => a.symbol)).toEqual(["NVDAx", "NVDAon", "SPYx"]);
    expect((await listAssets({ sector: "etf" })).data?.map((a) => a.symbol)).toEqual(["SPYx"]);
    expect((await listAssets()).data?.[1]).toMatchObject({ issuer: "Ondo Global Markets" });
  });

  it("rejects unknown inputs and reports an unavailable registry", async () => {
    expect((await listAssets({ kind: "crypto" })).reason).toMatch(/Invalid input/);
    mocks.getRegistry.mockRejectedValueOnce(new Error("Jupiter down"));
    expect(await listAssets()).toEqual({
      data: null,
      reason: "Asset registry unavailable: Jupiter down",
    });
  });
});

describe("getStockMetrics", () => {
  const fundamentals = () => {
    mocks.fetchProfile.mockResolvedValue({
      symbol: "NVDA",
      companyName: "NVIDIA Corporation",
      marketCap: 4.2e12,
      isEtf: false,
    });
    mocks.fetchPriceChange.mockResolvedValue({ symbol: "NVDA", "1M": 5.5, "6M": 12, "1Y": 48.2 });
    mocks.fetchRatiosTtm.mockResolvedValue({ priceToEarningsRatioTTM: 41.3 });
    mocks.fetchAnnualGrowth.mockResolvedValue({ date: "2026-01-25", revenueGrowth: 0.62 });
  };

  it("reports the real company's fundamentals for either issuer's token", async () => {
    fundamentals();
    const result = await getStockMetrics(["NVDAon"]);
    expect(result.data?.[0]).toMatchObject({
      ticker: "NVDAon",
      reason: null,
      data: {
        ticker: "NVDA",
        name: "NVIDIA Corporation",
        tokens: [
          { symbol: "NVDAx", issuer: "xStocks (Backed)" },
          { symbol: "NVDAon", issuer: "Ondo Global Markets" },
        ],
        isEtf: false,
        marketCapUsd: 4.2e12,
        peRatio: 41.3,
        return1MPct: 5.5,
        return6MPct: 12,
        return1YPct: 48.2,
        source: "Financial Modeling Prep",
        missing: {},
      },
    });
    expect(result.data?.[0]?.data?.revenueGrowthPct).toBeCloseTo(62, 9);
    expect(mocks.fetchProfile).toHaveBeenCalledWith("NVDA");
  });

  it("accepts the bare ticker and the provider's older field names", async () => {
    fundamentals();
    mocks.fetchRatiosTtm.mockResolvedValue({ peRatioTTM: 39 });
    mocks.fetchAnnualGrowth.mockResolvedValue({ growthRevenue: 0.1 });
    const metrics = (await getStockMetrics(["NVDA"])).data?.[0]?.data;
    expect(metrics).toMatchObject({ peRatio: 39, revenueGrowthPct: 10 });
  });

  it("marks P/E and growth as not applicable to ETFs, and negative P/E as not meaningful", async () => {
    fundamentals();
    mocks.fetchProfile.mockResolvedValueOnce({ symbol: "SPY", marketCap: 6e11, isEtf: true });
    const spy = (await getStockMetrics(["SPY"])).data?.[0]?.data;
    expect(spy).toMatchObject({ isEtf: true, peRatio: null, revenueGrowthPct: null });
    expect(spy?.missing).toEqual({
      peRatio: "Not applicable to an ETF or fund",
      revenueGrowthPct: "Not applicable to an ETF or fund",
    });

    clearCache();
    mocks.fetchRatiosTtm.mockResolvedValue({ priceToEarningsRatioTTM: -12 });
    const loss = (await getStockMetrics(["NVDAx"])).data?.[0]?.data;
    expect(loss).toMatchObject({
      peRatio: null,
      missing: { peRatio: "Negative earnings: P/E isn't meaningful" },
    });
  });

  it("returns null with the provider's reason for each field it couldn't get", async () => {
    fundamentals();
    mocks.fetchRatiosTtm.mockRejectedValue(new Error("Limit reached"));
    mocks.fetchPriceChange.mockResolvedValue({ symbol: "NVDA", "1M": 5, "6M": null, "1Y": 40 });
    const metrics = (await getStockMetrics(["NVDAx"])).data?.[0]?.data;
    expect(metrics).toMatchObject({ peRatio: null, return6MPct: null, marketCapUsd: 4.2e12 });
    expect(metrics?.missing).toEqual({
      peRatio: "Limit reached",
      return6MPct: "Financial Modeling Prep returned no 6M return",
    });
  });

  it("returns no data when every request fails, the ticker is unknown, or there's no key", async () => {
    for (const fn of [
      mocks.fetchProfile,
      mocks.fetchPriceChange,
      mocks.fetchRatiosTtm,
      mocks.fetchAnnualGrowth,
    ]) {
      fn.mockRejectedValue(new Error("Invalid API KEY"));
    }
    const results = (await getStockMetrics(["NVDAx", "AAPL"])).data!;
    expect(results).toEqual([
      { ticker: "NVDAx", data: null, reason: "Invalid API KEY" },
      { ticker: "AAPL", data: null, reason: `"AAPL" isn't a stock in Orchestra's asset registry` },
    ]);
    mocks.fmpConfigured.mockReturnValue(false);
    expect((await getStockMetrics(["SPY"])).data?.[0]?.reason).toMatch(/MARKET_DATA_API_KEY/);
  });

  it("caches market data for 15 minutes", async () => {
    fundamentals();
    await getStockMetrics(["NVDAx"]);
    await getStockMetrics(["NVDAon"]); // same company → same cache entries
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("validates input", async () => {
    expect((await getStockMetrics([])).reason).toMatch(/Invalid input/);
    expect((await getStockMetrics(["Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"])).reason).toMatch(
      /Invalid input/,
    );
    expect((await getStockMetrics("NVDA")).reason).toMatch(/Invalid input/);
  });
});

describe("getSwapQuote", () => {
  const order = (overrides: object = {}) => ({
    requestId: "r1",
    transaction: "BASE64TX",
    inputMint: USDC_MINT,
    outputMint: SPYX.mint,
    inAmount: "100000000",
    outAmount: "850000000",
    otherAmountThreshold: "845000000",
    priceImpact: -0.05,
    router: "metis",
    feeBps: 2,
    gasless: false,
    signatureFeeLamports: 5000,
    prioritizationFeeLamports: 10_000,
    rentFeeLamports: 2_039_280,
    ...overrides,
  });

  beforeEach(() => {
    mocks.getWalletBalances.mockResolvedValue({
      [USDC_MINT]: { amount: "500000000", decimals: 6 },
    });
  });

  it("quotes USDC → stock for the wallet and never returns the transaction", async () => {
    mocks.getOrder.mockResolvedValue(order());
    const result = await getSwapQuote({ ticker: "SPYx", usdcAmount: 100, wallet: WALLET });
    expect(mocks.getOrder).toHaveBeenCalledWith({
      inputMint: USDC_MINT,
      outputMint: SPYX.mint,
      amount: "100000000",
      taker: WALLET,
    });
    expect(result.data).toMatchObject({
      symbol: "SPYx",
      usdcIn: 100,
      expectedOut: 8.5,
      minimumOut: 8.45,
      priceImpactPct: 0.05,
      thinLiquidity: false,
      feeBps: 2,
      router: "metis",
      warning: null,
      executed: false,
    });
    expect(result.data?.networkFeesSol).toBeCloseTo(0.00205428, 9);
    expect(JSON.stringify(result)).not.toContain("BASE64TX");
  });

  it("passes on Jupiter's reason when the wallet can't make the trade", async () => {
    mocks.getOrder.mockResolvedValue(
      order({ transaction: "", errorCode: 1, errorMessage: "Insufficient funds", priceImpact: -2 }),
    );
    const result = await getSwapQuote({ ticker: "NVDAx", usdcAmount: 5000, wallet: WALLET });
    expect(result.data).toMatchObject({
      warning: expect.stringContaining("Insufficient balance"),
      thinLiquidity: true,
    });
  });

  it("warns when the wallet holds less USDC than quoted, even if Jupiter (RFQ) didn't check", async () => {
    mocks.getOrder.mockResolvedValue(order({ router: "jupiterz", gasless: true }));
    mocks.getWalletBalances.mockResolvedValue({});
    const result = await getSwapQuote({ ticker: "SPYx", usdcAmount: 100, wallet: WALLET });
    expect(result.data?.warning).toBe("The wallet holds 0 USDC, less than the 100 USDC quoted");

    mocks.getWalletBalances.mockRejectedValue(new Error("rpc down"));
    expect(
      (await getSwapQuote({ ticker: "SPYx", usdcAmount: 100, wallet: WALLET })).data?.warning,
    ).toBeNull();
  });

  it("refuses ambiguous tickers, non-stocks, invalid input and failed quotes", async () => {
    expect((await getSwapQuote({ ticker: "NVDA", usdcAmount: 10, wallet: WALLET })).reason).toMatch(
      /use the token symbol/,
    );
    expect((await getSwapQuote({ ticker: "SOL", usdcAmount: 10, wallet: WALLET })).reason).toMatch(
      /isn't in Orchestra's asset registry/,
    );
    expect((await getSwapQuote({ ticker: "SPYx", usdcAmount: 0, wallet: WALLET })).reason).toMatch(
      /Invalid input/,
    );
    expect((await getSwapQuote({ ticker: "SPYx", usdcAmount: 10, wallet: "nope" })).reason).toMatch(
      /Invalid input/,
    );
    expect(
      (await getSwapQuote({ ticker: "SPYx", usdcAmount: 10, wallet: WALLET, mint: SPYX.mint }))
        .reason,
    ).toMatch(/Invalid input/);
    mocks.getOrder.mockRejectedValue(
      new JupiterApiError(400, JSON.stringify({ error: "Failed to get quotes" }), null),
    );
    expect(await getSwapQuote({ ticker: "SPYx", usdcAmount: 10, wallet: WALLET })).toEqual({
      data: null,
      reason: "Jupiter couldn't quote this: Failed to get quotes",
    });
    expect(mocks.getOrder).toHaveBeenCalledTimes(1);
  });
});

describe("getWalletBalances", () => {
  it("returns SOL and USDC in whole units, zero when absent", async () => {
    mocks.getWalletBalances.mockResolvedValue({
      [SOL_MINT]: { amount: "310000000", decimals: 9 },
      [USDC_MINT]: { amount: "12500000", decimals: 6 },
    });
    expect((await getWalletBalances(WALLET)).data).toMatchObject({
      wallet: WALLET,
      sol: 0.31,
      usdc: 12.5,
    });
    mocks.getWalletBalances.mockResolvedValue({ [SOL_MINT]: { amount: "0", decimals: 9 } });
    expect((await getWalletBalances(WALLET)).data).toMatchObject({ sol: 0, usdc: 0 });
  });

  it("reports RPC failures and invalid wallets", async () => {
    mocks.getWalletBalances.mockRejectedValue(new Error("429 Too Many Requests"));
    expect(await getWalletBalances(WALLET)).toEqual({
      data: null,
      reason: "Couldn't read the wallet: 429 Too Many Requests",
    });
    expect((await getWalletBalances("0xabc")).reason).toMatch(/Invalid input/);
  });
});
