import "server-only";

/**
 * Spaces out background Jupiter calls (registry builds, /assets prices and
 * test quotes) so they stay inside the free plan's 1 request/second and leave
 * room for swaps, which are not paced.
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
