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
 * Buying assistant plans against the real local Postgres, with the registry,
 * Jupiter and Solana RPC faked in memory. Fake orders are real v0
 * transactions, so the "signed exactly the quoted order" check runs for real.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const fake = vi.hoisted(() => ({
  usdc: 0n,
  orders: new Map<string, { amount: bigint; outputMint: string }>(),
  /** What the next /execute calls do, in order; default "success". */
  executions: [] as ("success" | "land-failed" | "expired" | "network")[],
  outcome: null as unknown,
  deltas: {} as Record<string, bigint>,
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/assets/registry", () => {
  const asset = (kind: string, ticker: string, symbol: string, name: string, mint: string) => ({
    kind,
    ticker,
    symbol,
    name,
    mint,
    decimals: kind === "stock" ? 8 : 9,
    category: kind === "stock" ? "Stock" : "Major",
    icon: null,
    liquidityUsd: null,
    volume24hUsd: null,
  });
  return {
    getRegistry: async () => ({
      stocks: [
        asset("stock", "NVDA", "NVDAx", "NVIDIA", "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"),
      ],
      crypto: [
        asset("crypto", "SOL", "SOL", "Solana", "So11111111111111111111111111111111111111112"),
        {
          ...asset(
            "crypto",
            "USDC",
            "USDC",
            "USD Coin",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          ),
          cash: true,
        },
      ],
    }),
  };
});
vi.mock("@/server/solana/rpc", () => ({
  getWalletBalances: async () => ({
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { amount: fake.usdc.toString(), decimals: 6 },
  }),
  getTransactionOutcome: async () => fake.outcome,
  walletDeltas: () => fake.deltas,
}));

const owner = Keypair.generate();
const maker = Keypair.generate();
const OWNER = owner.publicKey.toBase58();
const OTHER = Keypair.generate().publicKey.toBase58();
let counter = 0;

/** A real unsigned v0 transaction that the owner must sign. */
function orderTransaction(): string {
  const message = new TransactionMessage({
    payerKey: new PublicKey(OWNER),
    recentBlockhash: bs58.encode(new Uint8Array(32).fill(++counter % 250)),
    instructions: [
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: maker.publicKey,
        lamports: counter,
      }),
    ],
  }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64");
}

vi.mock("@/server/jupiter/swap", () => ({
  getOrder: async (q: { inputMint: string; outputMint: string; amount: string; taker: string }) => {
    const requestId = `req-${++counter}`;
    fake.orders.set(requestId, { amount: BigInt(q.amount), outputMint: q.outputMint });
    return {
      requestId,
      transaction: orderTransaction(),
      inAmount: q.amount,
      outAmount: "12345",
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
    fake.usdc -= order.amount;
    return {
      status: "Success",
      code: 0,
      signature: `sig-${requestId}`,
      totalInputAmount: order.amount.toString(),
      totalOutputAmount: "12345",
    };
  },
}));

import type { PreparedItem } from "@/lib/assistant/views";
import { db } from "@/server/db";
import { InvestError } from "@/server/invest/service";

import { acceptDisclosure } from "./disclosure";
import {
  abandonItem,
  createExecution,
  executeItem,
  getExecution,
  listExecutions,
  prepareItem,
} from "./executions";

const plan = {
  rankingMethod: "Largest by market cap",
  items: [
    { kind: "stock" as const, symbol: "NVDAx", usdcAmount: 30, reason: "Largest company" },
    { kind: "crypto" as const, symbol: "SOL", usdcAmount: 20, reason: "Largest L1 by volume" },
  ],
};

const signed = (prepared: PreparedItem, forged = false) => {
  if (prepared.status !== "quoted") throw new Error(`expected a quote, got ${prepared.status}`);
  const tx = VersionedTransaction.deserialize(Buffer.from(prepared.order.transaction, "base64"));
  if (forged) tx.signatures[0] = new Uint8Array(64).fill(7);
  else tx.sign([owner]);
  return Buffer.from(tx.serialize()).toString("base64");
};
const buy = async (id: string, index: number) =>
  executeItem(id, index, OWNER, signed(await prepareItem(id, index, OWNER)));
const rejects = (promise: Promise<unknown>, status: number) =>
  expect(promise).rejects.toSatisfy((e) => e instanceof InvestError && e.status === status);

const cleanup = async () => {
  await db.planExecution.deleteMany({ where: { owner: { in: [OWNER, OTHER] } } });
  await db.assistantDisclosure.deleteMany({ where: { owner: { in: [OWNER, OTHER] } } });
};

beforeEach(async () => {
  await cleanup();
  await acceptDisclosure(OWNER);
  fake.usdc = 100_000_000n; // 100 USDC
  fake.executions = [];
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("assistant plan executions", () => {
  it("requires the disclosure, and resolves mints from the registry, never the client", async () => {
    await rejects(createExecution(OTHER, plan), 403);

    const execution = await createExecution(OWNER, plan);
    expect(execution).toMatchObject({ status: "planned", totalUsdc: 50 });
    expect(execution.items.map((i) => [i.symbol, i.name, i.status])).toEqual([
      ["NVDAx", "NVIDIA", "pending"],
      ["SOL", "Solana", "pending"],
    ]);
    expect(JSON.stringify(execution)).not.toContain("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh");
    const stored = await db.planExecutionItem.findMany({
      where: { executionId: execution.id },
      orderBy: { index: "asc" },
    });
    expect(stored.map((i) => i.mint)).toEqual([
      "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
      "So11111111111111111111111111111111111111112",
    ]);
  });

  it("checks the edited plan like the assistant's: registry, minimum, USDC balance", async () => {
    const withItems = (items: typeof plan.items) => createExecution(OWNER, { ...plan, items });
    await rejects(withItems([{ ...plan.items[0]!, symbol: "FAKE" }]), 400);
    await rejects(withItems([{ ...plan.items[0]!, kind: "crypto" }]), 400); // NVDAx isn't crypto
    await rejects(withItems([{ ...plan.items[0]!, usdcAmount: 5 }]), 400); // below $10
    await rejects(withItems([{ ...plan.items[0]!, symbol: "USDC", kind: "crypto" }]), 400);
    await rejects(withItems([{ ...plan.items[0]!, usdcAmount: 150 }]), 400); // wallet has 100
  });

  it("buys item by item, records partial failure, and retries the failed item", async () => {
    const { id } = await createExecution(OWNER, plan);
    const first = await buy(id, 0);
    expect(first.outcome).toBe("succeeded");
    expect(first.execution.status).toBe("executing");
    expect(first.execution.items[0]).toMatchObject({
      status: "succeeded",
      signature: expect.stringMatching(/^sig-req-/),
      inputAmount: "30000000",
      outputAmount: "12345",
    });

    fake.executions = ["land-failed"];
    const second = await buy(id, 1);
    expect(second.outcome).toBe("failed");
    expect(second.execution.status).toBe("partial");
    expect(second.execution.items[1]!.error).toMatch(/land/i);

    const retried = await buy(id, 1);
    expect(retried.outcome).toBe("succeeded");
    expect(retried.execution.status).toBe("completed");
    expect(retried.execution.completedAt).not.toBeNull();
    expect(fake.usdc).toBe(50_000_000n);
    await rejects(prepareItem(id, 0, OWNER), 409); // already bought
  });

  it("only sends the exact order this wallet signed", async () => {
    const { id } = await createExecution(OWNER, plan);
    const prepared = await prepareItem(id, 0, OWNER);
    await rejects(executeItem(id, 0, OWNER, signed(prepared, true)), 400);
    // A different transaction, properly signed by the owner.
    const other = await prepareItem(id, 1, OWNER);
    await rejects(executeItem(id, 0, OWNER, signed(other)), 400);
  });

  it("re-quotes after an expired order and lets a declined item be retried", async () => {
    const { id } = await createExecution(OWNER, plan);
    fake.executions = ["expired"];
    const expired = await buy(id, 0);
    expect(expired.outcome).toBe("requote");
    expect(expired.execution.items[0]!.status).toBe("pending");
    expect((await buy(id, 0)).outcome).toBe("succeeded");

    await prepareItem(id, 1, OWNER);
    const declined = await abandonItem(
      id,
      1,
      OWNER,
      "You declined the transaction in your wallet.",
    );
    expect(declined.items[1]).toMatchObject({
      status: "failed",
      error: expect.stringMatching(/declined/),
    });
    expect(declined.status).toBe("partial");
    expect((await buy(id, 1)).outcome).toBe("succeeded");
  });

  it("fails an item up front when the wallet no longer has its USDC", async () => {
    const { id } = await createExecution(OWNER, plan);
    fake.usdc = 25_000_000n;
    const prepared = await prepareItem(id, 0, OWNER);
    expect(prepared).toMatchObject({ status: "failed", reason: expect.stringMatching(/USDC/) });
  });

  it("reconciles a buy whose /execute call was lost, from the chain", async () => {
    const { id } = await createExecution(OWNER, plan);
    fake.executions = ["network"];
    const lost = await buy(id, 0);
    expect(lost.outcome).toBe("unknown");
    expect(lost.execution.items[0]!.status).toBe("executing");
    await rejects(prepareItem(id, 1, OWNER), 409); // nothing else while one is in flight

    await db.$executeRaw`UPDATE plan_execution_items SET updated_at = now() - interval '2 minutes' WHERE execution_id = ${id}::uuid AND index = 0`;
    fake.outcome = { status: "succeeded", transaction: { blockTime: 1_760_000_000 } };
    fake.deltas = { [USDC]: -30_000_000n, Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh: 777n };
    const reconciled = await getExecution(id, OWNER);
    expect(reconciled.items[0]).toMatchObject({
      status: "succeeded",
      inputAmount: "30000000",
      outputAmount: "777",
    });
  });

  it("keeps executions private to their wallet", async () => {
    const { id } = await createExecution(OWNER, plan);
    await rejects(getExecution(id, OTHER), 404);
    await rejects(prepareItem(id, 0, OTHER), 404);
    expect(await listExecutions(OTHER)).toEqual([]);
    expect((await listExecutions(OWNER)).map((e) => e.id)).toEqual([id]);
  });
});
