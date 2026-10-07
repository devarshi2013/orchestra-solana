import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://orchestra:orchestra@localhost:5432/orchestra?schema=public",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
    NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

/**
 * Rebalance execution against the real local Postgres, with the wallet,
 * Jupiter and Solana RPC faked in memory. The fake orders are real v0
 * transactions, so the "signed exactly the quoted order" check runs for real.
 */

const SOL = "So11111111111111111111111111111111111111112";
const JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DECIMALS: Record<string, number> = { [SOL]: 9, [JUP]: 6, [USDC]: 6 };
const PRICE: Record<string, number> = { [SOL]: 100, [JUP]: 0.5, [USDC]: 1 };

const fake = vi.hoisted(() => ({
  wallet: new Map<string, bigint>(),
  orders: new Map<string, { inputMint: string; outputMint: string; amount: bigint; out: bigint }>(),
  /** What the next /execute calls do, in order; default "success". */
  executions: [] as ("success" | "land-failed" | "expired" | "network")[],
  feePayer: null as string | null,
  outcome: null as unknown,
  deltas: {} as Record<string, bigint>,
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/market/store", () => ({
  loadDailyMarketData: async () => ({ dates: ["2026-10-06"], closes: {} }),
  trackMints: async () => {},
}));
vi.mock("@/server/jupiter/price", () => ({
  getUsdPrices: async (mints: string[]) =>
    Object.fromEntries(mints.filter((m) => PRICE[m]).map((m) => [m, PRICE[m]])),
}));
vi.mock("@/server/solana/rpc", () => ({
  getWalletBalances: async () =>
    Object.fromEntries(
      [...fake.wallet].map(([mint, amount]) => [
        mint,
        { amount: amount.toString(), decimals: DECIMALS[mint] },
      ]),
    ),
  getMintDecimals: async (mint: string) => DECIMALS[mint],
  getTransactionOutcome: async () => fake.outcome,
  walletDeltas: () => fake.deltas,
  getBlockHeight: async () => 1,
}));

const owner = Keypair.generate();
const maker = Keypair.generate();
const OWNER = owner.publicKey.toBase58();
let requestCounter = 0;

/** A real unsigned v0 transaction that the owner must sign (fee payer configurable). */
function orderTransaction(): string {
  const payer = new PublicKey(fake.feePayer ?? OWNER);
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: bs58.encode(new Uint8Array(32).fill(++requestCounter % 250)),
    instructions: [
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: maker.publicKey,
        lamports: requestCounter,
      }),
    ],
  }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64");
}

vi.mock("@/server/jupiter/swap", () => ({
  getOrder: async (q: { inputMint: string; outputMint: string; amount: string }) => {
    const amount = BigInt(q.amount);
    const usd = (Number(amount) / 10 ** DECIMALS[q.inputMint]!) * PRICE[q.inputMint]!;
    const out = BigInt(
      Math.floor((usd / PRICE[q.outputMint]!) * 0.998 * 10 ** DECIMALS[q.outputMint]!),
    );
    const requestId = `req-${++requestCounter}`;
    fake.orders.set(requestId, { inputMint: q.inputMint, outputMint: q.outputMint, amount, out });
    return {
      requestId,
      transaction: orderTransaction(),
      inAmount: q.amount,
      outAmount: out.toString(),
      router: "metis",
      priceImpact: -0.01,
      feeBps: 2,
    };
  },
  executeOrder: async ({ requestId }: { requestId: string }) => {
    const behavior = fake.executions.shift() ?? "success";
    if (behavior === "network") throw new TypeError("fetch failed");
    if (behavior === "expired") return { status: "Failed", code: -1, error: "requestId expired" };
    if (behavior === "land-failed")
      return { status: "Failed", code: -1000, error: "Failed to land" };
    const order = fake.orders.get(requestId)!;
    fake.wallet.set(order.inputMint, (fake.wallet.get(order.inputMint) ?? 0n) - order.amount);
    fake.wallet.set(order.outputMint, (fake.wallet.get(order.outputMint) ?? 0n) + order.out);
    return {
      status: "Success",
      code: 0,
      signature: `sig-${requestId}`,
      totalInputAmount: order.amount.toString(),
      totalOutputAmount: order.out.toString(),
    };
  },
}));

import { db } from "@/server/db";

import { checkDueInvestments } from "./notify";
import {
  createRun,
  executeLeg,
  getOwnedRun,
  InvestError,
  prepareLeg,
  reconcileRun,
  type PreparedLeg,
} from "./service";

const sixtyForty = {
  version: 1,
  name: "Test 60/40",
  root: {
    type: "group",
    name: "g",
    weight: { method: "specified", percentages: [60, 40] },
    children: [
      { type: "asset", mint: SOL },
      { type: "asset", mint: JUP },
    ],
  },
};

const units = (mint: string, n: number) => BigInt(Math.round(n * 10 ** DECIMALS[mint]!));
const signed = (prepared: PreparedLeg) => {
  if (prepared.status !== "quoted") throw new Error(`expected a quote, got ${prepared.status}`);
  const tx = VersionedTransaction.deserialize(Buffer.from(prepared.order.transaction, "base64"));
  tx.sign([owner]);
  return Buffer.from(tx.serialize()).toString("base64");
};
const newInvestment = (overrides: Record<string, unknown> = {}) =>
  db.investment.create({
    data: {
      owner: OWNER,
      name: "Test 60/40",
      symphony: sixtyForty,
      rebalance: { kind: "weekly" },
      driftThresholdPct: 0,
      ...overrides,
    },
  });
/** Prepares, signs and executes a leg. */
const runLeg = async (runId: string, index: number) => {
  const prepared = await prepareLeg(runId, index, OWNER);
  return executeLeg(runId, index, OWNER, signed(prepared));
};

beforeEach(async () => {
  await db.investment.deleteMany({ where: { owner: OWNER } });
  fake.wallet = new Map([
    [USDC, units(USDC, 1000)],
    [SOL, units(SOL, 0.05)], // 0.02 SOL stays as the fee reserve
  ]);
  fake.executions = [];
  fake.feePayer = null;
});

afterAll(async () => {
  await db.investment.deleteMany({ where: { owner: OWNER } });
  await db.$disconnect();
});

describe("rebalance execution", () => {
  it("funds a 60/40 from USDC: buys in order, records prices, finalizes the investment", async () => {
    const investment = await newInvestment();
    const { run } = await createRun(investment);
    // $1,003 total ($1,000 USDC + 0.03 investable SOL): buy $598.80 SOL, then $401.20 JUP.
    expect(run!.legs.map((l) => [l.side, l.mint, Number(l.plannedUsd.toFixed(2))])).toEqual([
      ["buy", SOL, 598.8],
      ["buy", JUP, 401.2],
    ]);

    expect((await runLeg(run!.id, 0)).outcome).toBe("succeeded");
    const done = await runLeg(run!.id, 1);
    expect(done.outcome).toBe("succeeded");
    expect(done.run.status).toBe("completed");
    const [solLeg, jupLeg] = done.run.legs;
    expect(solLeg).toMatchObject({
      status: "succeeded",
      signature: expect.stringMatching(/^sig-/),
    });
    // Paid $598.80 for 5.976 SOL (0.2% fee) → $100.20 per SOL.
    expect(solLeg!.realizedPrice).toBeCloseTo(100 / 0.998, 2);
    expect(jupLeg!.realizedPrice).toBeCloseTo(0.5 / 0.998, 4);

    const after = await db.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(after.lastRebalancedAt).not.toBeNull();
    expect(after.nextDueAt!.getTime()).toBeGreaterThan(Date.now());
    expect(after.holdings).toMatchObject({ [JUP]: expect.any(Number), [SOL]: expect.any(Number) });
  });

  it("stops partway on a failed swap, then resumes that leg", async () => {
    fake.wallet.set(SOL, units(SOL, 10.02)); // $1,000 of SOL + $1,000 USDC
    fake.wallet.set(USDC, 0n);
    const investment = await newInvestment();
    const { run } = await createRun(investment);
    expect(run!.legs.map((l) => l.side)).toEqual(["sell", "buy"]); // sells first

    fake.executions = ["success", "land-failed"];
    await runLeg(run!.id, 0);
    const failed = await runLeg(run!.id, 1);
    expect(failed.outcome).toBe("failed");
    expect(failed.run.status).toBe("partial");
    expect(failed.run.legs[1]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("didn't land"),
    });

    // Resume: the failed leg is re-sized from the USDC the sell produced.
    const resumed = await runLeg(run!.id, 1);
    expect(resumed.run.status).toBe("completed");
  });

  it("re-quotes after an expired quote; nothing is recorded as traded", async () => {
    const { run } = await createRun(await newInvestment());
    fake.executions = ["expired"];
    const expired = await runLeg(run!.id, 0);
    expect(expired.outcome).toBe("requote");
    expect(expired.run.legs[0]).toMatchObject({ status: "pending", inputAmount: null });
    expect((await runLeg(run!.id, 0)).outcome).toBe("succeeded");
  });

  it("refuses a transaction that isn't the quoted order", async () => {
    const { run } = await createRun(await newInvestment());
    const prepared = await prepareLeg(run!.id, 0, OWNER);
    const other = VersionedTransaction.deserialize(Buffer.from(orderTransaction(), "base64"));
    other.sign([owner]);
    await expect(
      executeLeg(run!.id, 0, OWNER, Buffer.from(other.serialize()).toString("base64")),
    ).rejects.toThrow("The signed transaction isn't the quoted order");
    expect((await getOwnedRun(run!.id, OWNER)).legs[0]!.status).toBe("quoted");
    expect(prepared.status).toBe("quoted");
  });

  it("runs legs strictly in order and only for the owner", async () => {
    const { run } = await createRun(await newInvestment());
    await expect(prepareLeg(run!.id, 1, OWNER)).rejects.toThrow("Earlier legs must finish first");
    await expect(
      prepareLeg(run!.id, 0, Keypair.generate().publicKey.toBase58()),
    ).rejects.toBeInstanceOf(InvestError);
    await expect(
      createRun(await db.investment.findFirstOrThrow({ where: { owner: OWNER } })),
    ).rejects.toThrow("already open");
  });

  it("reconciles a swap whose /execute call was lost, from its on-chain transaction", async () => {
    const { run } = await createRun(await newInvestment());
    fake.executions = ["network"];
    const lost = await runLeg(run!.id, 0);
    expect(lost.outcome).toBe("unknown");
    const leg = lost.run.legs[0]!;
    expect(leg.status).toBe("executing");
    expect(leg.signature).not.toBeNull(); // the owner paid fees, so we knew the signature

    await db.rebalanceLeg.update({
      where: { id: leg.id },
      data: { updatedAt: new Date(Date.now() - 90_000) },
    });
    fake.outcome = { status: "succeeded", transaction: { blockTime: 1_791_331_200 } };
    fake.deltas = { [USDC]: -units(USDC, 598.8), [SOL]: units(SOL, 5.976) };
    await reconcileRun(run!.id);
    const reconciled = (await getOwnedRun(run!.id, OWNER)).legs[0]!;
    expect(reconciled).toMatchObject({
      status: "succeeded",
      inputAmount: "598800000",
      outputAmount: "5976000000",
    });
    expect(reconciled.realizedPrice).toBeCloseTo(100.2, 1);
  });

  it("blocks retrying a swap whose outcome can't be known", async () => {
    fake.feePayer = maker.publicKey.toBase58(); // RFQ: the maker pays, signature unknown until /execute
    const { run } = await createRun(await newInvestment());
    fake.executions = ["network"];
    const lost = await runLeg(run!.id, 0);
    expect(lost.run.legs[0]!.signature).toBeNull();

    await db.rebalanceLeg.update({
      where: { id: lost.run.legs[0]!.id },
      data: { updatedAt: new Date(Date.now() - 240_000) },
    });
    await reconcileRun(run!.id);
    const run2 = await getOwnedRun(run!.id, OWNER);
    expect(run2.status).toBe("partial");
    expect(run2.legs[0]).toMatchObject({ status: "failed", outcomeUnknown: true });
    await expect(prepareLeg(run!.id, 0, OWNER)).rejects.toThrow("start a fresh rebalance");
  });
});

describe("due checks", () => {
  it("notifies once while the notice is unread, and reschedules", async () => {
    const investment = await newInvestment({
      nextDueAt: new Date(Date.now() - 1000),
      notifyEmail: "me@example.com",
    });
    const first = await checkDueInvestments(new Date(), () => false);
    expect(first.notified).toContain(investment.id);
    const after = await db.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(after.nextDueAt!.getTime()).toBeGreaterThan(Date.now());
    const [notice] = await db.notification.findMany({ where: { investmentId: investment.id } });
    expect(notice).toMatchObject({
      kind: "rebalance_due",
      url: expect.stringContaining(`/invest/${investment.id}/rebalance`),
    });

    await db.investment.update({
      where: { id: investment.id },
      data: { nextDueAt: new Date(Date.now() - 1000) },
    });
    const second = await checkDueInvestments(new Date(), () => false);
    expect(second.notified).not.toContain(investment.id);
    expect(await db.notification.count({ where: { investmentId: investment.id } })).toBe(1);
  });

  it("threshold rules notify only past their drift", async () => {
    // Already at 60/40 → drift 0: due but not needed.
    fake.wallet = new Map([
      [SOL, units(SOL, 6.02)],
      [JUP, units(JUP, 800)],
    ]);
    const investment = await newInvestment({
      rebalance: { kind: "threshold", driftPct: 5 },
      nextDueAt: new Date(Date.now() - 1000),
    });
    const report = await checkDueInvestments(new Date(), () => false);
    expect(report.notified).not.toContain(investment.id);
  });
});
