import "server-only";

/**
 * Spaces out Jupiter quote calls made in a batch (a company's tokens quoted
 * one after another) so they stay inside the free plan's 1 request/second.
 * Swaps the user is signing are not paced. Nothing is retried.
 */
const GAP_MS = 1100;
let next = 0;

export async function paced<T>(call: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const wait = next - now;
  next = Math.max(now, next) + GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return call();
}
