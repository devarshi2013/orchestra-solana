import { describe, expect, it } from "vitest";

import { cleanEnvValue, clientEnvSchema, serverEnvSchema } from "./schema";

const validServer = { JUPITER_API_KEY: "jup_test" };

describe("serverEnvSchema", () => {
  it("applies defaults", () => {
    const env = serverEnvSchema.parse(validServer);
    expect(env.JUPITER_API_BASE_URL).toBe("https://api.jup.ag");
    expect(env.SOLANA_RPC_URL).toBe("https://api.mainnet-beta.solana.com");
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
    expect(serverEnvSchema.safeParse({}).success).toBe(false);
  });

  it("treats blank optional keys as unset", () => {
    const env = serverEnvSchema.parse({
      ...validServer,
      ANTHROPIC_API_KEY: " ",
      MARKET_DATA_API_KEY: "",
    });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.MARKET_DATA_API_KEY).toBeUndefined();
  });
});

describe("clientEnvSchema", () => {
  it("defaults the browser RPC to the public mainnet endpoint", () => {
    expect(clientEnvSchema.parse({}).NEXT_PUBLIC_SOLANA_RPC_URL).toBe(
      "https://api.mainnet-beta.solana.com",
    );
  });

  it("rejects a non-URL RPC", () => {
    expect(clientEnvSchema.safeParse({ NEXT_PUBLIC_SOLANA_RPC_URL: "nope" }).success).toBe(false);
  });
});

describe("cleanEnvValue", () => {
  it("trims, strips one pair of quotes, and treats blank as unset", () => {
    expect(cleanEnvValue('  "https://api.jup.ag"  ')).toBe("https://api.jup.ag");
    expect(cleanEnvValue("'abc'")).toBe("abc");
    expect(cleanEnvValue('""')).toBeUndefined();
    expect(cleanEnvValue(" ")).toBeUndefined();
    expect(cleanEnvValue(undefined)).toBeUndefined();
  });
});
