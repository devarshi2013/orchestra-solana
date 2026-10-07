import { describe, expect, it } from "vitest";

import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

import { executeBodySchema, orderQuerySchema } from "./requests";

describe("orderQuerySchema", () => {
  const base = { inputMint: SOL_MINT, outputMint: USDC_MINT, amount: "1000000" };

  it("accepts a valid quote request with and without taker", () => {
    expect(orderQuerySchema.safeParse(base).success).toBe(true);
    expect(orderQuerySchema.safeParse({ ...base, taker: USDC_MINT }).success).toBe(true);
  });

  it.each(["0", "-1", "1.5", "abc", "18446744073709551616"])("rejects amount %s", (amount) => {
    expect(orderQuerySchema.safeParse({ ...base, amount }).success).toBe(false);
  });

  it("rejects identical mints and bad addresses", () => {
    expect(orderQuerySchema.safeParse({ ...base, outputMint: SOL_MINT }).success).toBe(false);
    expect(orderQuerySchema.safeParse({ ...base, taker: "not-a-key" }).success).toBe(false);
  });
});

describe("executeBodySchema", () => {
  it("requires base64 and a requestId", () => {
    expect(executeBodySchema.safeParse({ signedTransaction: "AQID", requestId: "r" }).success).toBe(
      true,
    );
    expect(
      executeBodySchema.safeParse({ signedTransaction: "no spaces!", requestId: "r" }).success,
    ).toBe(false);
    expect(executeBodySchema.safeParse({ signedTransaction: "AQID", requestId: "" }).success).toBe(
      false,
    );
  });
});
