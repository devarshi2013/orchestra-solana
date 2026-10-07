import type { RebalanceRule } from "@/lib/backtest/types";

/**
 * When a live symphony is next due. Checks run daily just after the daily
 * candle closes and prices sync (00:10 UTC), so "due" times land at 00:20 UTC.
 */
export const DUE_HOUR_UTC = 0;
export const DUE_MINUTE_UTC = 20;

const at = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day, DUE_HOUR_UTC, DUE_MINUTE_UTC));

/**
 * The first due time strictly after `after`:
 * - daily, and threshold (whose drift is checked daily): the next day's check;
 * - weekly: the next Monday's check;
 * - monthly: the 1st of the next month's check.
 */
export function nextDueAt(rule: RebalanceRule, after: Date): Date {
  const y = after.getUTCFullYear();
  const m = after.getUTCMonth();
  const d = after.getUTCDate();
  const today = at(y, m, d);
  switch (rule.kind) {
    case "daily":
    case "threshold":
      return today > after ? today : at(y, m, d + 1);
    case "weekly": {
      const daysToMonday = (8 - today.getUTCDay()) % 7;
      const monday = at(y, m, d + daysToMonday);
      return monday > after ? monday : at(y, m, d + daysToMonday + 7);
    }
    case "monthly": {
      const first = at(y, m, 1);
      return first > after ? first : at(y, m + 1, 1);
    }
  }
}

export function describeRule(rule: RebalanceRule): string {
  switch (rule.kind) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly (Mondays)";
    case "monthly":
      return "Monthly (1st)";
    case "threshold":
      return `When any holding drifts ${rule.driftPct} pts from target`;
  }
}
