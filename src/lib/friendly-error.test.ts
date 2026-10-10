import { describe, expect, it } from "vitest";

import {
  combineKinds,
  FRIENDLY_MESSAGES,
  friendlyError,
  friendlyKind,
  retryDelayMs,
} from "./friendly-error";

const apiError = (status: number, message: string, code?: number) =>
  Object.assign(new Error(message), { name: "ApiError", status, code });

describe("friendlyError", () => {
  it("maps each failure to its one plain sentence", () => {
    expect(friendlyError(apiError(429, "Jupiter rate limit reached"))).toBe(
      "Prices are busy right now. Retrying in a moment…",
    );
    expect(friendlyError(apiError(400, "Failed to get quotes"))).toBe(
      "This stock can't be traded right now. Try a smaller amount or try again later.",
    );
    expect(friendlyError({ kind: "below_minimum" })).toBe(FRIENDLY_MESSAGES.no_route);
    expect(
      friendlyError({ kind: "unknown", message: "Quote not available from market maker" }),
    ).toBe(FRIENDLY_MESSAGES.no_route);
    // Jupiter's own wording for RFQ-only and closed-market tokens.
    for (const body of [
      '{"error":"Quote not available from market maker"}',
      '{"error":"Ondo tokens are only available via JupiterZ. Trading is not available outside of market hours. There is a minimum trade size of $1."}',
    ]) {
      expect(
        friendlyError(Object.assign(new Error("Jupiter API 400"), { status: 400, body })),
      ).toBe(FRIENDLY_MESSAGES.no_route);
    }
    expect(friendlyError(apiError(0, "Network error"))).toBe(
      "Connection issue. Check your internet and try again.",
    );
    expect(friendlyError(new TypeError("Failed to fetch"))).toBe(FRIENDLY_MESSAGES.network);
    expect(friendlyError(new DOMException("signal timed out", "TimeoutError"))).toBe(
      FRIENDLY_MESSAGES.network,
    );
    expect(friendlyError({ kind: "insufficient_balance" })).toBe("Not enough USDC for this trade.");
    expect(
      friendlyError(Object.assign(new Error("User rejected the request."), { code: 4001 })),
    ).toBe("Transaction cancelled in your wallet.");
    expect(
      friendlyError(
        Object.assign(new Error("Transaction cancelled"), { name: "WalletSignTransactionError" }),
      ),
    ).toBe(FRIENDLY_MESSAGES.rejected);
    expect(friendlyError(new Error("Unexpected token < in JSON at position 0"))).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("never echoes the raw error, request IDs or JSON", () => {
    const raw = Object.assign(new Error('Jupiter API 500 (request abc-123): {"code":-2000}'), {
      status: 502,
      body: '{"error":"internal","code":-2000}',
    });
    const text = friendlyError(raw);
    expect(text).toBe(FRIENDLY_MESSAGES.unknown);
    expect(text).not.toMatch(/abc-123|\{|-2000/);
  });

  it("keeps a friendly message that's passed back in (e.g. from the server)", () => {
    for (const [kind, message] of Object.entries(FRIENDLY_MESSAGES)) {
      expect(friendlyKind(message)).toBe(kind);
    }
  });
});

describe("combineKinds", () => {
  it("gives one reason for several token variants (BACon + BACx → one message)", () => {
    expect(combineKinds(["no_route", "rate_limited"])).toBe("rate_limited");
    expect(combineKinds(["no_route", "no_route"])).toBe("no_route");
    expect(combineKinds(["no_route", "insufficient_usdc"])).toBe("insufficient_usdc");
    expect(combineKinds([])).toBe("unknown");
  });
});

it("backs off 1 s, 2 s, 4 s", () => {
  expect([1, 2, 3].map(retryDelayMs)).toEqual([1000, 2000, 4000]);
});
