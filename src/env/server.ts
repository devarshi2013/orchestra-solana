import "server-only";

import { formatEnvError, serverEnvSchema, type ServerEnv } from "./schema";

let parsed: ServerEnv | undefined;

function parseServerEnv(): ServerEnv {
  if (parsed) return parsed;
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid server environment variables:\n${formatEnvError(result.error)}`);
  }
  return (parsed = result.data);
}

/**
 * Server env, validated on first use rather than at import. A missing secret
 * (e.g. DATABASE_URL on a fresh Vercel project) then fails only the requests
 * that need it, with a message naming it, instead of failing the whole build.
 */
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get: (_target, key) => parseServerEnv()[key as keyof ServerEnv],
  has: (_target, key) => key in parseServerEnv(),
  ownKeys: () => Reflect.ownKeys(parseServerEnv()),
  getOwnPropertyDescriptor: (_target, key) =>
    Reflect.getOwnPropertyDescriptor(parseServerEnv(), key),
});
