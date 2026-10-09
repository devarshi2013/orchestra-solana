import { describe, expect, it, vi } from "vitest";

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
const orders = vi.hoisted(() => new Map<string, { priceImpact: number; feeBps: number }>());
vi.mock("@/server/jupiter/swap", () => ({
  getOrder: async ({ outputMint }: { outputMint: string }) => {
    const o = orders.get(outputMint)!;
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
  it("quotes every issuer for a ticker and picks the cheaper route", async () => {
    orders.set(NVDAX, { priceImpact: -0.6, feeBps: 10 }); // 0.70%
    orders.set(NVDAON, { priceImpact: -0.1, feeBps: 5 }); // 0.15%
    const result = await quoteBestIssuer("NVDA", 50, WALLET);
    expect(result.data?.entry.symbol).toBe("NVDAon");
    expect(result.data?.quote).toMatchObject({ symbol: "NVDAon", issuer: "Ondo Global Markets" });
    expect(result.data?.quote.issuersCompared.map((i) => [i.symbol, i.totalCostPct])).toEqual([
      ["NVDAon", 0.15],
      ["NVDAx", 0.7],
    ]);
    expect(JSON.stringify(result.data?.quote)).not.toContain(NVDAON);

    orders.set(NVDAX, { priceImpact: -0.02, feeBps: 0 });
    expect((await quoteBestIssuer("NVDA", 50, WALLET)).data?.entry.symbol).toBe("NVDAx");
  });

  it("quotes only that issuer for a token symbol, and nothing outside the registry", async () => {
    orders.set(NVDAX, { priceImpact: -0.6, feeBps: 10 });
    orders.set(NVDAON, { priceImpact: -0.1, feeBps: 5 });
    expect((await quoteBestIssuer("NVDAx", 50, WALLET)).data?.entry.symbol).toBe("NVDAx");
    expect(await quoteBestIssuer("ZZZZ", 50, WALLET)).toMatchObject({
      data: null,
      reason: expect.stringContaining("isn't in Orchestra's stock registry"),
    });
  });
});
