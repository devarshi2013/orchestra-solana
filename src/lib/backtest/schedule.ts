import type { RebalanceRule } from "./types";

const DAY_MS = 86_400_000;

/** Monday-based week number (1970-01-01 was a Thursday, so +3 aligns weeks to Mondays). */
function weekKey(date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) / DAY_MS + 3) / 7);
}

/**
 * Whether a calendar rule trades on `date`, given the previous trading day
 * (null on the first day, which always trades). Threshold rules are decided
 * by drift in the engine; here they only trade on the first day.
 */
export function isScheduledRebalance(
  rule: RebalanceRule,
  date: string,
  previous: string | null,
): boolean {
  if (previous === null) return true;
  switch (rule.kind) {
    case "daily":
      return true;
    case "weekly":
      return weekKey(date) !== weekKey(previous);
    case "monthly":
      return date.slice(0, 7) !== previous.slice(0, 7);
    case "threshold":
      return false;
  }
}

/** Largest absolute gap between two weight maps, as a fraction. */
export function maxDrift(
  current: Readonly<Record<string, number>>,
  target: Readonly<Record<string, number>>,
): number {
  let drift = 0;
  for (const mint of new Set([...Object.keys(current), ...Object.keys(target)])) {
    drift = Math.max(drift, Math.abs((current[mint] ?? 0) - (target[mint] ?? 0)));
  }
  return drift;
}
