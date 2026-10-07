import { describe, expect, it } from "vitest";

import {
  classifyApiError,
  classifyExecuteResult,
  classifyOrderError,
  classifyWalletError,
} from "./errors";

describe("classifyOrderError", () => {
  it.each([
    ["metis", 1, "insufficient_balance"],
    ["metis", 2, "insufficient_sol"],
    ["okx", 3, "below_minimum"],
    ["jupiterz", 1, "insufficient_balance"],
    ["jupiterz", 3, "no_route"],
  ])("%s errorCode %i → %s", (router, errorCode, kind) => {
    expect(classifyOrderError({ router, errorCode, errorMessage: "x" }).kind).toBe(kind);
  });

  it("does not treat jupiterz code 2 (missing ATA) as low SOL", () => {
    expect(classifyOrderError({ router: "jupiterz", errorCode: 2 }).kind).not.toBe(
      "insufficient_sol",
    );
  });

  it("falls back to Jupiter's message", () => {
    const e = classifyOrderError({ router: "metis", errorCode: 99, errorMessage: "weird" });
    expect(e).toMatchObject({ kind: "unknown", message: "weird" });
  });
});

describe("classifyExecuteResult", () => {
  it.each([-1, -1004, -2003])("code %i is an expired quote", (code) => {
    expect(classifyExecuteResult({ code }).kind).toBe("expired");
  });

  it("detects slippage failures and keeps the signature", () => {
    const e = classifyExecuteResult({
      code: -1000,
      error: "Transaction failed: custom program error: 0x1771",
      signature: "abc",
    });
    expect(e).toMatchObject({ kind: "slippage", signature: "abc" });
  });

  it("detects SlippageToleranceExceeded by name", () => {
    expect(classifyExecuteResult({ code: -1001, error: "SlippageToleranceExceeded" }).kind).toBe(
      "slippage",
    );
  });

  it("detects insufficient SOL for fees", () => {
    expect(
      classifyExecuteResult({ code: -1000, error: "insufficient lamports 5000, need 10000" }).kind,
    ).toBe("insufficient_sol");
  });

  it("reports landing failures as unknown with a helpful title", () => {
    expect(classifyExecuteResult({ code: -1000 })).toMatchObject({
      kind: "unknown",
      title: "Transaction didn't land",
    });
  });
});

describe("classifyApiError", () => {
  it("maps rate limits and network errors", () => {
    expect(classifyApiError({ status: 429, message: "x" }).kind).toBe("rate_limited");
    expect(classifyApiError({ status: 0, message: "x" }).kind).toBe("network");
  });

  it("routes coded 400s through the execute classifier", () => {
    expect(classifyApiError({ status: 400, message: "expired", code: -1 }).kind).toBe("expired");
  });

  it("recognises no-route and too-small errors", () => {
    expect(classifyApiError({ status: 400, message: "No routes found" }).kind).toBe("no_route");
    expect(classifyApiError({ status: 400, message: "Failed to get quotes" }).kind).toBe(
      "no_route",
    );
    expect(classifyApiError({ status: 400, message: "Amount is too small" }).kind).toBe(
      "below_minimum",
    );
  });
});

describe("classifyWalletError", () => {
  it.each([
    { name: "WalletSignTransactionError", message: "User rejected the request." },
    { code: 4001, message: "" },
    { error: { code: 4001 }, message: "whatever" },
    new Error("Transaction cancelled"),
  ])("treats %o as a rejection", (error) => {
    expect(classifyWalletError(error).kind).toBe("rejected");
  });

  it("explains watch-only accounts", () => {
    const error = classifyWalletError(
      new Error("Account is read-only and cannot sign transactions"),
    );
    expect(error).toMatchObject({ kind: "wallet", title: "Watch-only account" });
  });

  it("keeps other wallet errors distinct", () => {
    expect(classifyWalletError(new Error("Wallet not connected")).kind).toBe("wallet");
  });
});
