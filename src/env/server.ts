import "server-only";

import { serverEnvSchema, type ServerEnv } from "./schema";

const shape = serverEnvSchema.shape;
type Key = keyof ServerEnv;
const cache = new Map<Key, unknown>();

/** One variable, validated with its own schema; throws naming just that variable. */
function read(key: Key): unknown {
  if (cache.has(key)) return cache.get(key);
  const result = shape[key].safeParse(process.env[key]);
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
 * missing secret only fails the features that use it (e.g. no DATABASE_URL
 * doesn't break wallet sign-in), with an error naming that variable.
 */
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get: (_target, key) => (typeof key === "string" && key in shape ? read(key as Key) : undefined),
});

/** Optional in the schema (development has fallbacks) but required in production. */
const REQUIRED_IN_PRODUCTION: Key[] = ["SESSION_SECRET", "CRON_SECRET"];

/** Which variables are missing or invalid (names only, never values), for /api/health. */
export function envProblems(): { missing: string[]; invalid: string[] } {
  const missing: string[] = [];
  const invalid: string[] = [];
  const production = process.env.NODE_ENV === "production";
  for (const key of Object.keys(shape) as Key[]) {
    if (production && REQUIRED_IN_PRODUCTION.includes(key) && !process.env[key]?.trim()) {
      missing.push(key);
      continue;
    }
    if (shape[key].safeParse(process.env[key]).success) continue;
    (process.env[key] === undefined || process.env[key]?.trim() === "" ? missing : invalid).push(
      key,
    );
  }
  return { missing, invalid };
}
