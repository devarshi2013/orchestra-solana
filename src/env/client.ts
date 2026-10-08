import { clientEnvSchema, cleanEnvValue, formatEnvError, type ClientEnv } from "./schema";

// NEXT_PUBLIC_* values are inlined at build time only when referenced by their
// full literal name, so each one must be listed explicitly here.
const raw = {
  NEXT_PUBLIC_SOLANA_CLUSTER: cleanEnvValue(process.env.NEXT_PUBLIC_SOLANA_CLUSTER),
  NEXT_PUBLIC_SOLANA_RPC_URL: cleanEnvValue(process.env.NEXT_PUBLIC_SOLANA_RPC_URL),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: cleanEnvValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
};

function parseClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse(raw);
  if (result.success) return result.data;
  // These are public settings with safe defaults (mainnet, public RPC): a bad
  // value mustn't break the build or the whole app, so fall back and say so.
  console.error(
    `Invalid client environment variables, using defaults:\n${formatEnvError(result.error)}`,
  );
  return clientEnvSchema.parse({});
}

export const clientEnv: ClientEnv = parseClientEnv();
