import type { NextConfig } from "next";

import { z } from "zod";

import { cleanEnv, clientEnvSchema, serverEnvSchema } from "./src/env";

// Check the environment on `next dev` / `next build` / `next start`: a missing
// or invalid variable fails, locally and on Vercel alike. SKIP_ENV_VALIDATION=1
// is for tooling without secrets (`pnpm typecheck` sets it, since `next typegen`
// loads this file).
if (!process.env.SKIP_ENV_VALIDATION) {
  for (const [label, schema] of [
    ["server", serverEnvSchema],
    ["client", clientEnvSchema],
  ] as const) {
    const result = schema.safeParse(cleanEnv(process.env));
    if (!result.success) {
      throw new Error(
        `Invalid ${label} environment variables:\n${z.prettifyError(result.error)}\nSee .env.example.`,
      );
    }
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The assistant moved to /chat; old links (and ?q= pre-fills) still work.
  redirects: () => [
    { source: "/assistant", destination: "/chat", permanent: true },
    // Research is the default page; the stock list lives at /explore.
    { source: "/", destination: "/chat", permanent: false },
    { source: "/markets", destination: "/explore", permanent: true },
    { source: "/profile", destination: "/portfolio", permanent: true },
    { source: "/markets/:symbol", destination: "/stocks/:symbol", permanent: true },
  ],
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
