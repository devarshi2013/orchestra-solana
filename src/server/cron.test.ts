import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

import { isAuthorizedCron } from "./cron";

const SECRET = "0123456789abcdef0123";

describe("isAuthorizedCron", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET, "production")).toBe(true);
    expect(isAuthorizedCron(`Bearer ${SECRET}x`, SECRET, "production")).toBe(false);
    expect(isAuthorizedCron(SECRET, SECRET, "production")).toBe(false);
    expect(isAuthorizedCron(null, SECRET, "development")).toBe(false);
  });

  it("without a secret, is open in development and closed in production", () => {
    expect(isAuthorizedCron(null, undefined, "development")).toBe(true);
    expect(isAuthorizedCron("Bearer anything", undefined, "production")).toBe(false);
  });
});
