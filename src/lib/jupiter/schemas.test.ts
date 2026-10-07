import { VersionedTransaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { base64ToBytes } from "@/lib/solana";
import { classifyOrderError } from "@/lib/swap/errors";
import { toTokenInfo } from "@/lib/tokens";

import insufficientFunds from "./__fixtures__/order-insufficient-funds.json";
import quoteOnly from "./__fixtures__/order-quote-only.json";
import withTransaction from "./__fixtures__/order-with-transaction.json";
import tokensSearch from "./__fixtures__/tokens-search.json";
import { mintInformationSchema, orderResponseSchema } from "./schemas";

// Contract tests against real api.jup.ag responses captured on 2026-10-07.

describe("orderResponseSchema (live fixtures)", () => {
  it("parses a quote-only response (no taker)", () => {
    const order = orderResponseSchema.parse(quoteOnly);
    expect(order.transaction).toBeNull();
    expect(order.routePlan?.length).toBeGreaterThan(0);
  });

  it("parses an executable order and deserializes its transaction", () => {
    const order = orderResponseSchema.parse(withTransaction);
    expect(order.transaction).toBeTruthy();
    expect(order.lastValidBlockHeight).toMatch(/^\d+$/);

    const tx = VersionedTransaction.deserialize(base64ToBytes(order.transaction!));
    const signer = tx.message.staticAccountKeys[0]!.toBase58();
    expect(signer).toBe(withTransaction.taker);
    expect(tx.message.header.numRequiredSignatures).toBeGreaterThanOrEqual(1);
  });

  it("parses an unbuildable order and classifies it", () => {
    const order = orderResponseSchema.parse(insufficientFunds);
    expect(order.transaction).toBe("");
    expect(classifyOrderError(order).kind).toBe("insufficient_balance");
  });
});

describe("mintInformationSchema (live fixtures)", () => {
  it("parses token search results", () => {
    const tokens = z.array(mintInformationSchema).parse(tokensSearch).map(toTokenInfo);
    expect(tokens[0]).toMatchObject({ symbol: expect.any(String), decimals: expect.any(Number) });
  });
});
