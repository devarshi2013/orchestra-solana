import type { NextConfig } from "next";

import { clientEnvSchema, formatEnvError, serverEnvSchema } from "./src/env/schema";

// Fail fast on `next dev` / `next build` / `next start` when env is misconfigured.
// SKIP_ENV_VALIDATION=1 is for tooling without secrets (`pnpm typecheck` sets it,
// since `next typegen` loads this file too).
if (!process.env.SKIP_ENV_VALIDATION) {
  for (const [label, schema] of [
    ["server", serverEnvSchema],
    ["client", clientEnvSchema],
  ] as const) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Invalid ${label} environment variables:\n${formatEnvError(result.error)}`);
    }
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
