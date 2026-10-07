import { describe, expect, it } from "vitest";

import { clientEnvSchema, serverEnvSchema } from "./schema";

const validServer = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JUPITER_API_KEY: "jup_test",
  SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
};

describe("serverEnvSchema", () => {
  it("applies defaults", () => {
    const env = serverEnvSchema.parse(validServer);
    expect(env.JUPITER_API_BASE_URL).toBe("https://api.jup.ag");
    expect(env.NODE_ENV).toBe("development");
  });

  it("strips trailing slashes from the Jupiter base URL", () => {
    const env = serverEnvSchema.parse({
      ...validServer,
      JUPITER_API_BASE_URL: "https://api.jup.ag/",
    });
    expect(env.JUPITER_API_BASE_URL).toBe("https://api.jup.ag");
  });

  it("rejects lite-api", () => {
    const result = serverEnvSchema.safeParse({
      ...validServer,
      JUPITER_API_BASE_URL: "https://lite-api.jup.ag",
    });
    expect(result.success).toBe(false);
  });

  it("requires a Jupiter API key", () => {
    expect(serverEnvSchema.safeParse({ ...validServer, JUPITER_API_KEY: " " }).success).toBe(false);
  });

  it("requires a postgres DATABASE_URL", () => {
    const result = serverEnvSchema.safeParse({ ...validServer, DATABASE_URL: "mysql://x@y/z" });
    expect(result.success).toBe(false);
  });
});

describe("clientEnvSchema", () => {
  it("defaults to mainnet-beta", () => {
    const env = clientEnvSchema.parse({ NEXT_PUBLIC_SOLANA_RPC_URL: "https://rpc.example.com" });
    expect(env.NEXT_PUBLIC_SOLANA_CLUSTER).toBe("mainnet-beta");
  });

  it("rejects unknown clusters", () => {
    const result = clientEnvSchema.safeParse({
      NEXT_PUBLIC_SOLANA_CLUSTER: "testnet",
      NEXT_PUBLIC_SOLANA_RPC_URL: "https://rpc.example.com",
    });
    expect(result.success).toBe(false);
  });
});
