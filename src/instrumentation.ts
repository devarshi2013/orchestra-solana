/**
 * Runs once per server start. Kicks off the asset registry's verification
 * against Jupiter (about 20 paced requests) without blocking startup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.SKIP_ENV_VALIDATION)
    return;
  const { warmRegistry } = await import("@/server/assets/registry");
  warmRegistry();
}
