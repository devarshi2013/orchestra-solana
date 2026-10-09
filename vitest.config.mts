import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude],
    // `server-only` throws outside React Server Components; stub it for unit tests.
    alias: { "server-only": new URL("./test/server-only-stub.ts", import.meta.url).pathname },
    coverage: { provider: "v8", include: ["src/**"] },
  },
});
