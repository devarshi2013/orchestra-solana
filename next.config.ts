import type { NextConfig } from "next";

import { cleanEnv, clientEnvSchema, formatEnvError, serverEnvSchema } from "./src/env/schema";

// Check the environment on `next dev` / `next build` / `next start`. Locally a
// misconfiguration fails fast; on Vercel it's a loud warning instead, so a
// project whose secrets aren't added yet still deploys (requests that need them
// fail with a message naming the variable). SKIP_ENV_VALIDATION=1 is for tooling
// without secrets (`pnpm typecheck` sets it, since `next typegen` loads this file).
if (!process.env.SKIP_ENV_VALIDATION) {
  for (const [label, schema] of [
    ["server", serverEnvSchema],
    ["client", clientEnvSchema],
  ] as const) {
    const result = schema.safeParse(cleanEnv(process.env));
    if (result.success) continue;
    const message = `Invalid ${label} environment variables:\n${formatEnvError(result.error)}`;
    if (!process.env.VERCEL) throw new Error(message);
    console.warn(
      `\n⚠ ${message}\n⚠ Add them in Vercel → Settings → Environment Variables (see docs/deployment.md), then redeploy.\n`,
    );
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
