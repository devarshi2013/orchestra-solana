import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://orchestra:orchestra@localhost:5432/orchestra?schema=public",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

/**
 * The assistant's symphony tools against the real Postgres, with the registry,
 * stored prices and the wallet snapshot faked.
 */

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const OWNER = "SymTools11111111111111111111111111111111111";
const OTHER = "SymTools22222222222222222222222222222222222";

const state = vi.hoisted(() => ({ session: null as string | null }));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ sessionWallet: async () => state.session }));
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
    listedAssets: async () => ({ isListed: () => true }),
    getRegistry: async () => ({
      stocks: [],
      crypto: [
        asset("SOL", "So11111111111111111111111111111111111111112"),
        asset("USDC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      ],
    }),
  };
});
// SOL rises for 60 days then falls: above its 50-day SMA on day 59, below by day 79.
vi.mock("@/lib/market/store", () => {
  const dates = Array.from({ length: 80 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  );
  const sol = [
    ...Array.from({ length: 60 }, (_, i) => 100 + i),
    ...Array.from({ length: 20 }, (_, i) => 159 - 6 * (i + 1)),
  ];
  return {
    trackMints: async () => {},
    loadDailyMarketData: async (mints: string[]) => ({
      dates,
      closes: Object.fromEntries(
        mints.map((m) => [m, m.startsWith("So1") ? sol : dates.map(() => 1)]),
      ),
    }),
  };
});
vi.mock("@/server/invest/service", async (importOriginal) => ({
  ...(await importOriginal<typeof InvestService>()),
  snapshot: async () => ({
    plan: {
      totalUsd: 250,
      positions: [
        { mint: "So11111111111111111111111111111111111111112", weight: 0.97, targetWeight: 0 },
        { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", weight: 0.03, targetWeight: 1 },
      ],
    },
  }),
}));

import type * as InvestService from "@/server/invest/service";
import { NextRequest } from "next/server";

import { PUT as putDraft } from "@/app/api/drafts/[id]/route";
import { loadDailyMarketData } from "@/lib/market/store";
import { evaluate } from "@/lib/symphony/evaluate";
import { solTrendFollower } from "@/lib/symphony/examples";
import { db } from "@/server/db";

import {
  explainRebalance,
  getSymphony,
  listMySymphonies,
  runSymphonyBacktest,
} from "./symphony-tools";

const cleanup = async () => {
  await db.investment.deleteMany({ where: { owner: { in: [OWNER, OTHER] } } });
  await db.symphonyDraft.deleteMany({ where: { owner: { in: [OWNER, OTHER] } } });
};
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

const newInvestment = () =>
  db.investment.create({
    data: {
      owner: OWNER,
      name: "Trend",
      symphony: solTrendFollower,
      rebalance: { kind: "weekly" },
      driftThresholdPct: 1,
      lastRebalancedAt: new Date("2026-03-01T12:00:00Z"), // day 59
    },
  });

describe("symphony tools", () => {
  it("lists and reads only the wallet's own symphonies, as ticker trees", async () => {
    const investment = await newInvestment();
    const list = await listMySymphonies(OWNER);
    expect(list.data?.map((s) => [s.kind, s.name])).toEqual([["investment", "Trend"]]);
    expect((await listMySymphonies(OTHER)).data).toEqual([]);

    const read = await getSymphony({ symphonyId: investment.id }, OWNER);
    expect(read.data).toMatchObject({ kind: "investment", rebalance: "Weekly (Mondays)" });
    expect(JSON.stringify(read.data)).not.toContain(SOL);
    expect(read.data?.symphony.root).toMatchObject({
      then: { ticker: "SOL" },
      else: { ticker: "USDC" },
    });
    expect((await getSymphony({ symphonyId: investment.id }, OTHER)).data).toBeNull();
  });

  it("explainRebalance compares the last rebalance with today, matching evaluate()", async () => {
    const investment = await newInvestment();
    const result = await explainRebalance({ symphonyId: investment.id }, OWNER);
    const ex = result.data!;
    const data = await loadDailyMarketData([SOL, USDC]);
    const label = (a: Record<string, number>) =>
      Object.fromEntries(Object.entries(a).map(([m, w]) => [m === SOL ? "SOL" : "USDC", w]));
    expect(ex.from).toBe("2026-03-01");
    expect(ex).toMatchObject({ since: "last_rebalance", walletUsd: 250 });
    expect(ex.to).toBe("2026-03-21");
    expect(ex.targetBefore).toEqual(label(evaluate(solTrendFollower.root, data, "2026-03-01")));
    expect(ex.targetNow).toEqual(label(evaluate(solTrendFollower.root, data, "2026-03-21")));
    expect(ex.conditions[0]).toMatchObject({
      changed: true,
      before: { result: true },
      now: { result: false },
    });
    expect(ex.drift).toEqual([
      { ticker: "SOL", weight: 0.97, target: 0, driftPts: 97 },
      { ticker: "USDC", weight: 0.03, target: 1, driftPts: -97 },
    ]);
    expect(ex.summary.at(-1)).toBe(
      "Your wallet is off target: SOL is 97.0% vs 0.0% target, USDC is 3.0% vs 100.0% target.",
    );
    expect((await explainRebalance({ symphonyId: investment.id }, OTHER)).data).toBeNull();
  });

  it("backtests a saved symphony or a ticker tree", async () => {
    const investment = await newInvestment();
    const byId = await runSymphonyBacktest({ symphonyId: investment.id, period: "max" }, OWNER);
    expect(byId.data).toMatchObject({ name: "Trend", period: "max", to: "2026-03-21" });
    const byTree = await runSymphonyBacktest(
      { symphony: { name: "Hold SOL", root: { type: "asset", ticker: "SOL" } }, period: "1Y" },
      OWNER,
    );
    expect(byTree.data?.totalReturn).toBeCloseTo(39 / 100 - 1, 1);
    const both = await runSymphonyBacktest(
      {
        symphonyId: investment.id,
        period: "1Y",
        symphony: { name: "x", root: { type: "asset", ticker: "SOL" } },
      },
      OWNER,
    );
    expect(both.reason).toMatch(/exactly one/);
  });

  it("a signed-in draft save claims the draft, but never changes its owner", async () => {
    const id = crypto.randomUUID();
    const save = () =>
      putDraft(
        new NextRequest(`http://localhost/api/drafts/${id}`, {
          method: "PUT",
          body: JSON.stringify({ symphony: solTrendFollower }),
        }),
        { params: Promise.resolve({ id }) },
      );
    state.session = null;
    await save();
    expect((await db.symphonyDraft.findUniqueOrThrow({ where: { id } })).owner).toBeNull();
    state.session = OWNER;
    await save();
    expect((await db.symphonyDraft.findUniqueOrThrow({ where: { id } })).owner).toBe(OWNER);
    state.session = OTHER;
    await save();
    expect((await db.symphonyDraft.findUniqueOrThrow({ where: { id } })).owner).toBe(OWNER);
    expect((await listMySymphonies(OWNER)).data?.map((s) => s.kind)).toEqual(["draft"]);
  });
});
