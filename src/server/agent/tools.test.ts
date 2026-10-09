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

vi.mock("@/server/assets/registry", () => {
  const stock = (ticker: string, symbol: string, mint: string) => ({
    kind: "stock",
    ticker,
    symbol,
    name: ticker,
    mint,
    category: "Stock",
    issuer: "xstocks",
    hours: "24/5",
    decimals: 8,
    icon: null,
    liquidityUsd: null,
    volume24hUsd: null,
  });
  return {
    getRegistry: async () => ({
      stocks: [
        stock("NVDA", "NVDAx", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"),
        stock("AAPL", "AAPLx", "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp"),
      ],
      crypto: [],
    }),
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

describe("listAssets (agent tool)", () => {
  it("lists only stocks, with no mints", async () => {
    const outcome = await runAgentTool("listAssets", {}, WALLET);
    expect(outcome.isError).toBe(false);
    const data = (JSON.parse(outcome.content) as { data: { symbol: string }[] }).data;
    expect(data.map((a) => a.symbol)).toEqual(["NVDAx", "AAPLx"]);
    expect(outcome.content).not.toContain("Xsc9qvGR");
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
    expect(outcome.plan?.items.map((i) => i.symbol)).toEqual(["NVDAx", "AAPLx"]);
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
