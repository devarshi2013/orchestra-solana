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

/** The short notice shown on stock items outside US market hours (whatever the reason). */
export function describeClosedMarket(): string {
  return "US market is closed. Prices may differ from the stock and spreads are wider.";
}

export type UsMarketClock = {
  session: UsMarketSession;
  /** Minutes since midnight in New York. */
  minuteOfDay: number;
  /** Minutes until the regular session next opens (when closed) or closes (when open). */
  minutesToChange: number;
  /** The regular session, as minutes since midnight in New York. */
  openMinute: number;
  closeMinute: number;
  /** Monday to Friday in New York: the days 24/5 tokens trade around the clock. */
  weekday: boolean;
};

/**
 * Where the US trading day stands at `now`, for a clock face: the New York
 * time, the regular session's bounds, and how long until it next opens or
 * closes. Days are assumed to be 24 hours long, so the countdown can be an
 * hour out across a daylight-saving change.
 */
export function usMarketClock(now: Date): UsMarketClock {
  const session = usMarketSession(now);
  const parts = (d: Date) =>
    Object.fromEntries(newYork.formatToParts(d).map((p) => [p.type, p.value]));
  const today = parts(now);
  const minuteOfDay = Number(today.hour) * 60 + Number(today.minute);
  const weekday = today.weekday !== "Sat" && today.weekday !== "Sun";
  let minutesToChange = CLOSE_MINUTE - minuteOfDay;
  if (!session.open) {
    minutesToChange = 0;
    for (let day = 0; day < 10; day++) {
      const p = parts(new Date(now.getTime() + day * 86_400_000));
      const trading =
        p.weekday !== "Sat" &&
        p.weekday !== "Sun" &&
        !HOLIDAYS.has(`${p.year}-${p.month}-${p.day}`);
      if (!trading || (day === 0 && minuteOfDay >= OPEN_MINUTE)) continue;
      minutesToChange = day * 1440 + OPEN_MINUTE - minuteOfDay;
      break;
    }
  }
  return {
    session,
    minuteOfDay,
    minutesToChange,
    openMinute: OPEN_MINUTE,
    closeMinute: CLOSE_MINUTE,
    weekday,
  };
}
