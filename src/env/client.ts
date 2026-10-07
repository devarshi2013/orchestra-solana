import { clientEnvSchema, formatEnvError, type ClientEnv } from "./schema";

// NEXT_PUBLIC_* values are inlined at build time only when referenced by their
// full literal name, so each one must be listed explicitly here.
const result = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});

if (!result.success) {
  throw new Error(`Invalid client environment variables:\n${formatEnvError(result.error)}`);
}

export const clientEnv: ClientEnv = result.data;
