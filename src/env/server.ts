import "server-only";

import { formatEnvError, serverEnvSchema, type ServerEnv } from "./schema";

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid server environment variables:\n${formatEnvError(result.error)}`);
  }
  return result.data;
}

export const serverEnv: ServerEnv = parseServerEnv();
