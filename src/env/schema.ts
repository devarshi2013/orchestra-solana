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

/** Unset or blank (e.g. `KEY=""` copied from .env.example) both read as undefined. */
const optionalSecret = (schema: z.ZodString) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url().refine((url) => /^postgres(ql)?:\/\//.test(url), {
    message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
  }),
  /** Jupiter Developer Platform key (sent as x-api-key). Server-side only. */
  JUPITER_API_KEY: z.string().trim().min(1, "JUPITER_API_KEY is required"),
  JUPITER_API_BASE_URL: jupiterBaseUrl,
  /** Server-side Solana RPC (may embed a provider key). Never exposed to the browser. */
  SOLANA_RPC_URL: z.url(),
  /**
   * Birdeye Data Services key (X-API-KEY) for historical OHLCV. Optional so the
   * app runs without it; /api/cron/prices responds 503 until it is set.
   */
  BIRDEYE_API_KEY: optionalSecret(z.string().trim()),
  /**
   * Shared secret for /api/cron/*, sent as `Authorization: Bearer <secret>`
   * (Vercel Cron does this automatically). Required in production.
   */
  CRON_SECRET: optionalSecret(
    z.string().trim().min(16, "CRON_SECRET must be at least 16 characters"),
  ),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SOLANA_CLUSTER: z.enum(["mainnet-beta", "devnet"]).default("mainnet-beta"),
  /** Browser RPC used by the wallet adapter. Use a public or origin-restricted endpoint. */
  NEXT_PUBLIC_SOLANA_RPC_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  return z.prettifyError(error);
}
