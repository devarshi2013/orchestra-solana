import { z } from "zod";

/**
 * The app's configuration: every environment variable, its schema, and typed
 * access. Each variable is validated when first read, on its own, so a missing
 * key only fails what uses it, with an error naming that variable.
 *
 * `serverEnv` is for server code only (ESLint keeps it out of components and
 * hooks). Only NEXT_PUBLIC_* values are inlined into the browser bundle, and
 * only when written out by their full literal name, as `PUBLIC_VALUES` does.
 */

/** A required URL: "<name> is required" when unset, "must be a URL" when it isn't one. */
const requiredUrl = (name: string) =>
  z.url({
    error: (issue) => (issue.input === undefined ? `${name} is required` : `${name} must be a URL`),
  });

/** Unset or blank (e.g. `KEY=""` copied from .env.example) both read as undefined. */
const optionalSecret = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const serverEnvSchema = z.object({
  /** Jupiter Developer Platform key (sent as x-api-key). */
  JUPITER_API_KEY: z.string().trim().min(1, "JUPITER_API_KEY is required"),
  JUPITER_API_BASE_URL: requiredUrl("JUPITER_API_BASE_URL")
    .refine((url) => !new URL(url).hostname.startsWith("lite-api."), {
      message: "lite-api.jup.ag is being phased out; use https://api.jup.ag",
    })
    .transform((url) => url.replace(/\/+$/, "")),
  /** Claude API key for the stock assistant (/api/agent); without it the assistant is off. */
  ANTHROPIC_API_KEY: optionalSecret,
  /** Financial Modeling Prep key for stock fundamentals; without it that tool is off. */
  MARKET_DATA_API_KEY: optionalSecret,
  /** CoinGecko API key (Demo or Pro) for price charts; without it charts are off. */
  COINGECKO_API_KEY: optionalSecret,
  /** https://api.coingecko.com/api/v3 for a Demo key, https://pro-api.coingecko.com/api/v3 for Pro. */
  COINGECKO_API_BASE_URL: z
    .url()
    .refine((url) => /^(pro-)?api\.coingecko\.com$/.test(new URL(url).hostname), {
      message:
        "Use https://api.coingecko.com/api/v3 (Demo) or https://pro-api.coingecko.com/api/v3 (Pro)",
    })
    .transform((url) => url.replace(/\/+$/, ""))
    .optional(),
  /** Server-side Solana RPC (may embed a provider key). */
  SOLANA_RPC_URL: requiredUrl("SOLANA_RPC_URL"),
  /** Neon / Vercel Postgres connection string for strategies, fills and notifications; without it strategies are off. */
  DATABASE_URL: optionalSecret,
  /** Signs session cookies (wallet sign-in), at least 32 characters; without it strategies are off. */
  SESSION_SECRET: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(z.string().min(32, "SESSION_SECRET must be at least 32 characters").optional())
    .optional(),
  /** Bearer token for the strategy watcher (/api/strategies/run), at least 16 characters. */
  CRON_SECRET: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(z.string().min(16, "CRON_SECRET must be at least 16 characters").optional())
    .optional(),
});

export const clientEnvSchema = z.object({
  /** Browser RPC (block height checks while a trade signs). Use a public or origin-restricted endpoint. */
  NEXT_PUBLIC_SOLANA_RPC_URL: requiredUrl("NEXT_PUBLIC_SOLANA_RPC_URL"),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;
type ClientEnv = z.infer<typeof clientEnvSchema>;

const PUBLIC_VALUES: Record<keyof ClientEnv, string | undefined> = {
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
};

/**
 * A value as typed into a hosting dashboard: trimmed, with one matching pair
 * of surrounding quotes removed ("…" or '…'), since values are often pasted
 * straight from .env files where they're quoted. Blank means unset.
 */
function cleanEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  const cleaned = /^(["'])([\s\S]*)\1$/.exec(trimmed ?? "")?.[2]?.trim() ?? trimmed;
  return cleaned || undefined;
}

/** process.env with every value cleaned (see cleanEnvValue). */
export const cleanEnv = (env: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(env).map(([k, v]) => [k, cleanEnvValue(v)]));

/** Typed access to `schema`'s variables, each validated (and cached) on first read. */
function lazyEnv<T extends z.ZodObject>(schema: T, raw: (key: string) => string | undefined) {
  const cache = new Map<string, unknown>();
  return new Proxy({} as z.infer<T>, {
    get(_target, key) {
      if (typeof key !== "string" || !(key in schema.shape)) return undefined;
      if (cache.has(key)) return cache.get(key);
      const value = raw(key);
      const result = (schema.shape[key] as z.ZodType).safeParse(cleanEnvValue(value));
      if (!result.success) {
        const problem = value === undefined ? "is not set" : "is invalid";
        throw new Error(
          `Environment variable ${key} ${problem}: ${result.error.issues[0]?.message ?? ""}. ` +
            "Add it in Vercel → Settings → Environment Variables, then redeploy.",
        );
      }
      cache.set(key, result.data);
      return result.data;
    },
  });
}

export const serverEnv: ServerEnv = lazyEnv(serverEnvSchema, (key) => process.env[key]);
export const clientEnv: ClientEnv = lazyEnv(
  clientEnvSchema,
  (key) => PUBLIC_VALUES[key as keyof ClientEnv],
);

/** Which server variables are missing or invalid (names only, never values), for /api/health. */
export function envProblems() {
  const keys = Object.keys(serverEnvSchema.shape) as (keyof ServerEnv)[];
  const failing = keys.filter(
    (key) => !serverEnvSchema.shape[key].safeParse(cleanEnvValue(process.env[key])).success,
  );
  const unset = (key: string) => !process.env[key]?.trim();
  return { missing: failing.filter(unset), invalid: failing.filter((key) => !unset(key)) };
}
