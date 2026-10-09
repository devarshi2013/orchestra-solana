import { z } from "zod";

/**
 * Environment schemas. This module has no runtime side effects so it can be
 * imported from next.config.ts (build-time validation), from server code, and
 * from tests. Do not import `server-only` here.
 */

const jupiterBaseUrl = z
  .url()
  .default("https://api.jup.ag")
  .refine((url) => !new URL(url).hostname.startsWith("lite-api."), {
    message: "lite-api.jup.ag is being phased out; use https://api.jup.ag",
  })
  .transform((url) => url.replace(/\/+$/, ""));

/**
 * A value as typed into a hosting dashboard: trimmed, with one matching pair
 * of surrounding quotes removed ("…" or '…'), since values are often pasted
 * straight from .env files where they're quoted.
 */
export function cleanEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  const quoted = /^(["'])([\s\S]*)\1$/.exec(trimmed);
  const cleaned = quoted ? quoted[2]!.trim() : trimmed;
  // Blank (e.g. KEY="" copied from .env.example) means unset, so defaults apply.
  return cleaned === "" ? undefined : cleaned;
}

/** process.env with every value cleaned (see cleanEnvValue). */
export function cleanEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, cleanEnvValue(v)]));
}

/** Unset or blank (e.g. `KEY=""` copied from .env.example) both read as undefined. */
const optionalSecret = (schema: z.ZodString) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );

export const serverEnvSchema = z.object({
  /** Jupiter Developer Platform key (sent as x-api-key). Server-side only. */
  JUPITER_API_KEY: z.string().trim().min(1, "JUPITER_API_KEY is required"),
  JUPITER_API_BASE_URL: jupiterBaseUrl,
  /** Claude API key for the stock assistant (/api/agent). Server-only; without it the assistant is off. */
  ANTHROPIC_API_KEY: optionalSecret(z.string().trim()),
  /** Financial Modeling Prep key for stock fundamentals (docs/market-tools.md). Optional. */
  MARKET_DATA_API_KEY: optionalSecret(z.string().trim()),
  /** Server-side Solana RPC (may embed a provider key). Never exposed to the browser. */
  SOLANA_RPC_URL: z.url().default("https://api.mainnet-beta.solana.com"),
});

export const clientEnvSchema = z.object({
  /** Browser RPC used by the wallet adapter. Use a public or origin-restricted endpoint. */
  NEXT_PUBLIC_SOLANA_RPC_URL: z.url().default("https://api.mainnet-beta.solana.com"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  return z.prettifyError(error);
}
