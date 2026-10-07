import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/invest/service", () => ({ snapshot: vi.fn() }));
vi.mock("@/server/assets/registry", () => {
  const asset = (ticker: string, mint: string) => ({
    kind: "crypto",
    ticker,
    symbol: ticker,
    name: ticker,
    mint,
    category: "Major",
    decimals: 6,
    icon: null,
    liquidityUsd: null,
    volume24hUsd: null,
  });
  return {
    getRegistry: async () => ({
      stocks: [],
      crypto: [
        asset("SOL", "So11111111111111111111111111111111111111112"),
        { ...asset("USDC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), cash: true },
      ],
    }),
  };
});
vi.mock("@/lib/market/store", () => {
  const dates = Array.from({ length: 120 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  );
  return {
    trackMints: vi.fn(async () => {}),
    loadDailyMarketData: async (mints: string[]) => ({
      dates,
      closes: Object.fromEntries(
        mints.map((m) => [m, dates.map((_, i) => (m.startsWith("EPj") ? 1 : 100 + i))]),
      ),
    }),
  };
});

import { runAgentTool } from "./tools";

const valid = {
  name: "Trend",
  root: {
    type: "if",
    condition: {
      left: { ticker: "SOL", indicator: { fn: "price" } },
      comparator: "gt",
      right: { ticker: "SOL", indicator: { fn: "sma", period: 50 } },
    },
    then: { type: "asset", ticker: "SOL" },
    else: { type: "asset", ticker: "USDC" },
  },
};

describe("createSymphony (agent tool)", () => {
  it("rejects an AI-proposed symphony with an unknown asset, and proposes nothing", async () => {
    const proposal = structuredClone(valid);
    proposal.root.then = { type: "asset", ticker: "DOGE" };
    const outcome = await runAgentTool("createSymphony", { symphony: proposal }, SOL);
    expect(outcome.isError).toBe(true);
    expect(outcome.symphony).toBeUndefined();
    expect(JSON.parse(outcome.content)).toEqual({
      accepted: false,
      errors: [`root.then: "DOGE" isn't in Orchestra's asset registry`],
    });
  });

  it("rejects a mint written in place of a ticker, and bad weights", async () => {
    const withMint = structuredClone(valid);
    withMint.root.else = { type: "asset", ticker: USDC };
    expect((await runAgentTool("createSymphony", { symphony: withMint }, SOL)).isError).toBe(true);

    const badWeights = {
      name: "Split",
      root: {
        type: "group",
        name: "g",
        weight: { method: "specified", percentages: [60] },
        children: [
          { type: "asset", ticker: "SOL" },
          { type: "asset", ticker: "USDC" },
        ],
      },
    };
    const outcome = await runAgentTool("createSymphony", { symphony: badWeights }, SOL);
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toMatch(/root/);
  });

  it("accepts a valid one: backtested, shown as a proposal, no mints for the model", async () => {
    const outcome = await runAgentTool("createSymphony", { symphony: valid, period: "3M" }, SOL);
    expect(outcome.isError).toBe(false);
    expect(outcome.symphony?.tree.name).toBe("Trend");
    expect(outcome.symphony?.backtest).toMatchObject({ period: "3M", to: "2026-04-30" });
    const content = JSON.parse(outcome.content) as Record<string, unknown>;
    expect(content.accepted).toBe(true);
    expect(outcome.content).not.toContain(SOL);
    expect(outcome.content).not.toContain(USDC);
  });
});
