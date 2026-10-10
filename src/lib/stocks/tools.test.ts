import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, { JUPITER_API_KEY: "jup_test_key" });
});

const WALLET = "2bQ6SPX7mz5DHa7hunC9L1QUdGuHpLuKBNKA11MkFSeQ";
const NVDAX = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh";
const NVDAON = "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo";

vi.mock("@/lib/stocks/registry.generated.json", () => {
  const stock = (symbol: string, mint: string, issuer: string) => ({
    ticker: "NVDA",
    companyName: "NVIDIA",
    type: "stock",
    sector: "Technology",
    industry: "Semiconductors",
    mint,
    issuer,
    liquidityTier: "high",
    symbol,
    decimals: 9,
    hours: "24/5",
    preIpo: false,
    sectorSource: "nasdaq",
    testImpactPct: 0.05,
  });
  return {
    default: {
      syncedAt: "2026-10-09T00:00:00Z",
      testQuoteUsdc: 100,
      sources: {},
      stocks: [
        stock("NVDAx", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", "xstocks"),
        stock("NVDAon", "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo", "ondo"),
      ],
    },
  };
});
vi.mock("@/server/jupiter/pace", () => ({ paced: <T>(call: () => Promise<T>) => call() }));
vi.mock("@/server/solana/rpc", () => ({
  getWalletBalances: async () => ({
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { amount: "500000000", decimals: 6 },
  }),
}));
const orders = vi.hoisted(
  () =>
    new Map<string, { priceImpact: number; feeBps: number } | { status: number; text: string }>(),
);
const calls = vi.hoisted(() => [] as string[]);
vi.mock("@/server/jupiter/swap", () => ({
  getOrder: async ({ outputMint }: { outputMint: string }) => {
    calls.push(outputMint);
    const o = orders.get(outputMint)!;
    if ("status" in o) throw Object.assign(new Error(o.text), { status: o.status });
    return {
      inAmount: "50000000",
      outAmount: "250000000",
      otherAmountThreshold: "249000000",
      priceImpact: o.priceImpact,
      feeBps: o.feeBps,
      router: "metis",
      transaction: "AQID",
      gasless: false,
      signatureFeeLamports: 5000,
      prioritizationFeeLamports: 0,
      rentFeeLamports: 0,
    };
  },
}));

import { quoteBestIssuer } from "./tools";

describe("quoteBestIssuer", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("tries one token at a time, most liquid first, and stops at the first that works", async () => {
    orders.set(NVDAX, { priceImpact: -0.6, feeBps: 10 });
    orders.set(NVDAON, { priceImpact: -0.1, feeBps: 5 });
    const result = await quoteBestIssuer("NVDA", 50, WALLET);
    // The mock lists NVDAx first, but both are "high", so registry order stands.
    expect(result.data?.entry.symbol).toBe("NVDAx");
    expect(calls).toEqual([NVDAX]);
    expect(result.data?.quote).toMatchObject({ symbol: "NVDAx", issuer: "xStocks (Backed)" });
    expect(JSON.stringify(result.data?.quote)).not.toContain(NVDAX);
  });

  it("moves on when a token fails, and gives one friendly reason when all do", async () => {
    orders.set(NVDAX, { status: 400, text: '{"error":"Failed to get quotes"}' });
    orders.set(NVDAON, { priceImpact: -0.1, feeBps: 5 });
    expect((await quoteBestIssuer("NVDA", 51, WALLET)).data?.entry.symbol).toBe("NVDAon");

    orders.set(NVDAON, { status: 429, text: "Too many requests" });
    const failed = await quoteBestIssuer("NVDA", 52, WALLET);
    expect(failed).toEqual({
      data: null,
      reason: "Prices are busy right now. Retrying in a moment…",
      kind: "rate_limited",
    });

    orders.set(NVDAON, { status: 400, text: '{"error":"No route found"}' });
    expect(await quoteBestIssuer("NVDA", 53, WALLET)).toMatchObject({
      reason: "This stock can't be traded right now. Try a smaller amount or try again later.",
      kind: "no_route",
    });
  });

  it("reuses a successful quote for 10 seconds", async () => {
    orders.set(NVDAX, { priceImpact: -0.6, feeBps: 10 });
    await quoteBestIssuer("NVDA", 60, WALLET);
    await quoteBestIssuer("NVDA", 60, WALLET);
    expect(calls).toHaveLength(1);
  });

  it("quotes only that issuer for a token symbol, and nothing outside the registry", async () => {
    orders.set(NVDAX, { priceImpact: -0.6, feeBps: 10 });
    orders.set(NVDAON, { priceImpact: -0.1, feeBps: 5 });
    expect((await quoteBestIssuer("NVDAon", 50, WALLET)).data?.entry.symbol).toBe("NVDAon");
    expect(await quoteBestIssuer("ZZZZ", 50, WALLET)).toMatchObject({
      data: null,
      reason: expect.stringContaining("isn't in Quill's stock registry"),
    });
  });
});
