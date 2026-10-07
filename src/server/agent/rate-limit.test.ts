import { describe, expect, it } from "vitest";

import { WalletRateLimiter } from "./rate-limit";

describe("WalletRateLimiter", () => {
  it("allows one run at a time per wallet", () => {
    const limiter = new WalletRateLimiter(10, 60_000, () => 0);
    const first = limiter.acquire("A");
    expect(first.ok).toBe(true);
    expect(limiter.acquire("A")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("in progress"),
    });
    expect(limiter.acquire("B").ok).toBe(true); // other wallets unaffected
    if (first.ok) first.release();
    expect(limiter.acquire("A").ok).toBe(true);
  });

  it("caps runs per window and says when to retry", () => {
    let now = 0;
    const limiter = new WalletRateLimiter(2, 60_000, () => now);
    for (let i = 0; i < 2; i++) {
      const run = limiter.acquire("A");
      if (run.ok) run.release();
      now += 1000;
    }
    expect(limiter.acquire("A")).toEqual({
      ok: false,
      reason: "Limit of 2 requests per hour reached",
      retryAfterS: 58,
    });
    now = 60_001;
    expect(limiter.acquire("A").ok).toBe(true);
  });
});
