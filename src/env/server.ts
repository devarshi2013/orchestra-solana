import "server-only";

import { cleanEnvValue, serverEnvSchema, type ServerEnv } from "./schema";

const shape = serverEnvSchema.shape;
type Key = keyof ServerEnv;
const cache = new Map<Key, unknown>();

/** One variable, validated with its own schema; throws naming just that variable. */
function read(key: Key): unknown {
  if (cache.has(key)) return cache.get(key);
  const result = shape[key].safeParse(cleanEnvValue(process.env[key]));
  if (!result.success) {
    const problem = process.env[key] === undefined ? "is not set" : "is invalid";
    throw new Error(
      `Environment variable ${key} ${problem}: ${result.error.issues[0]?.message ?? ""}. ` +
        "Add it in Vercel → Settings → Environment Variables, then redeploy.",
    );
  }
  cache.set(key, result.data);
  return result.data;
}

/**
 * Server env. Each variable is validated when first read, on its own, so a
 * missing secret only fails the features that use it (e.g. no ANTHROPIC_API_KEY
 * doesn't break swaps), with an error naming that variable.
 */
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get: (_target, key) => (typeof key === "string" && key in shape ? read(key as Key) : undefined),
});

/** Which variables are missing or invalid (names only, never values), for /api/health. */
export function envProblems(): { missing: string[]; invalid: string[] } {
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const key of Object.keys(shape) as Key[]) {
    if (shape[key].safeParse(cleanEnvValue(process.env[key])).success) continue;
    (process.env[key] === undefined || process.env[key]?.trim() === "" ? missing : invalid).push(
      key,
    );
  }
  return { missing, invalid };
}
