import "server-only";

/**
 * A small in-memory TTL cache for upstream data. Stores the promise, so
 * concurrent callers share one request; failures are not cached.
 */
const entries = new Map<string, { expires: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load();
  entries.set(key, { expires: Date.now() + ttlMs, value });
  value.catch(() => entries.delete(key));
  return value;
}

/** Test helper. */
export function clearCache(): void {
  entries.clear();
}
