import { defineConfig } from "vitest/config";

/** Tests against the local Postgres from docker-compose (`pnpm db:up && pnpm db:migrate`). */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    alias: { "server-only": new URL("./test/server-only-stub.ts", import.meta.url).pathname },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
