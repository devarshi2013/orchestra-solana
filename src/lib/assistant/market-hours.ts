/**
 * Regular US equity market hours (NYSE/Nasdaq): 9:30–16:00 America/New_York,
 * Monday to Friday, except exchange holidays. Tokenized stocks keep trading
 * outside these hours (24/5), but the underlying market is shut, so prices
 * can drift and spreads widen; the plan card warns about it.
 */

/** NYSE full-day closures. Years not listed fall back to weekday and hour checks only. */
const HOLIDAYS = new Set([
  // 2026
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  // 2027
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;

export type UsMarketSession =
  { open: true } | { open: false; reason: "weekend" | "holiday" | "pre-market" | "after-hours" };

const newYork = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Whether the US stock market is in its regular session at `now`. */
export function usMarketSession(now: Date): UsMarketSession {
  const parts = Object.fromEntries(newYork.formatToParts(now).map((p) => [p.type, p.value]));
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return { open: false, reason: "weekend" };
  if (HOLIDAYS.has(`${parts.year}-${parts.month}-${parts.day}`))
    return { open: false, reason: "holiday" };
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  if (minute < OPEN_MINUTE) return { open: false, reason: "pre-market" };
  if (minute >= CLOSE_MINUTE) return { open: false, reason: "after-hours" };
  return { open: true };
}

export function describeClosedMarket(reason: Exclude<UsMarketSession, { open: true }>["reason"]) {
  const when = {
    weekend: "it's the weekend",
    holiday: "it's a US market holiday",
    "pre-market": "it's before 9:30 ET",
    "after-hours": "it's after 16:00 ET",
  }[reason];
  return `US market closed (${when}): the token still trades, but its price can drift from the stock and spreads are wider`;
}
