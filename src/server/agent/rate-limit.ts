import "server-only";

/**
 * Per-wallet limits for the assistant: one run at a time, and at most
 * `maxPerWindow` runs per `windowMs`. In memory: this is per server instance,
 * which is enough for one Next.js server (docs/assistant.md).
 */
export class WalletRateLimiter {
  private readonly runs = new Map<string, { started: number[]; active: boolean }>();

  constructor(
    private readonly maxPerWindow = 20,
    private readonly windowMs = 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Starts a run, or says why it can't (with seconds until it can). */
  acquire(
    wallet: string,
  ): { ok: true; release: () => void } | { ok: false; reason: string; retryAfterS: number } {
    const entry = this.runs.get(wallet) ?? { started: [], active: false };
    const cutoff = this.now() - this.windowMs;
    entry.started = entry.started.filter((t) => t > cutoff);
    if (entry.active)
      return {
        ok: false,
        reason: "A response is already in progress for this wallet",
        retryAfterS: 5,
      };
    if (entry.started.length >= this.maxPerWindow) {
      const retryAfterS = Math.ceil((entry.started[0]! + this.windowMs - this.now()) / 1000);
      return {
        ok: false,
        reason: `Limit of ${this.maxPerWindow} requests per hour reached`,
        retryAfterS,
      };
    }
    entry.started.push(this.now());
    entry.active = true;
    this.runs.set(wallet, entry);
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        entry.active = false;
      },
    };
  }
}

export const agentRateLimiter = new WalletRateLimiter();
