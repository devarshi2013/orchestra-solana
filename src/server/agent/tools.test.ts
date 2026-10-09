import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WALLET = "2bQ6SPX7mz5DHa7hunC9L1QUdGuHpLuKBNKA11MkFSeQ";
const state = vi.hoisted(() => ({ usdc: "100000000" }));

vi.mock("@/lib/stocks/registry.generated.json", () => {
  const stock = (ticker: string, symbol: string, mint: string, sector: string) => ({
    ticker,
    companyName: ticker,
    type: "stock",
    sector,
    industry: null,
    mint,
    issuer: "xstocks",
    liquidityTier: "high",
    symbol,
    decimals: 8,
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
        stock("NVDA", "NVDAx", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", "Technology"),
        stock("AAPL", "AAPLx", "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", "Technology"),
        stock("JPM", "JPMx", "XsMAqkcKsUewDrzVkait4e5u4y8REgtyS7jWgCpLV2C", "Financials"),
      ],
    },
  };
});
vi.mock("@/server/solana/rpc", () => ({
  getWalletBalances: async () => ({
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { amount: state.usdc, decimals: 6 },
  }),
}));

import { runAgentTool } from "./tools";

const plan = (items: object[], totalUsdc: number) => ({
  items,
  totalUsdc,
  rankingMethod: "Largest US tech by market cap",
});
const item = (ticker: string, usdcAmount: number) => ({
  kind: "stock",
  ticker,
  usdcAmount,
  reason: "Large cap",
});

beforeEach(() => {
  state.usdc = "100000000"; // 100 USDC
});

describe("listStocks (agent tool)", () => {
  type Listing = { data: { searched: { sectors: string[] }; companies: { ticker: string }[] } };

  it("lists registry companies by sector, says what it searched, and never returns mints", async () => {
    const outcome = await runAgentTool("listStocks", { sector: "tech" }, WALLET);
    expect(outcome.isError).toBe(false);
    const { data } = JSON.parse(outcome.content) as Listing;
    expect(data.searched.sectors).toEqual(["Technology"]);
    expect(data.companies.map((c) => c.ticker)).toEqual(["AAPL", "NVDA"]);
    expect(outcome.content).not.toContain("Xsc9qvGR");
  });

  it("explains an unknown sector", async () => {
    const outcome = await runAgentTool("listStocks", { sector: "crypto" }, WALLET);
    expect(outcome.content).toMatch(/Unknown sector.*Health Care/);
  });
});

describe("submit_plan (agent tool)", () => {
  it("accepts a valid stock plan within the wallet's USDC", async () => {
    const outcome = await runAgentTool(
      "submit_plan",
      plan([item("NVDAx", 30), item("AAPL", 20)], 50),
      WALLET,
    );
    expect(outcome.isError).toBe(false);
    expect(outcome.plan?.items.map((i) => i.symbol)).toEqual(["NVDAx", "AAPL"]);
    expect(outcome.content).not.toContain(USDC);
  });

  it("rejects unknown or non-stock tickers, crypto items, small orders and overspending", async () => {
    const reject = async (input: object) => {
      const outcome = await runAgentTool("submit_plan", input, WALLET);
      expect(outcome.isError).toBe(true);
      expect(outcome.plan).toBeUndefined();
      return (JSON.parse(outcome.content) as { errors?: string[] }).errors?.join(" ") ?? "";
    };
    expect(await reject(plan([item("DOGE", 20)], 20))).toMatch(/DOGE/);
    expect(await reject(plan([{ ...item("SOL", 20), kind: "crypto" }], 20))).toMatch(/kind|stock/i);
    expect(await reject(plan([item("NVDAx", 5)], 5))).toMatch(/10/);
    state.usdc = "30000000";
    expect(await reject(plan([item("NVDAx", 50)], 50))).toMatch(/USDC|balance|wallet/i);
  });
});
