import { describe, expect, it } from "vitest";

import { describeClosedMarket, usMarketSession } from "./market-hours";

/** New York wall-clock time → Date (EDT is UTC−4 in summer, EST UTC−5 in winter). */
const ny = (iso: string, offset: "-04:00" | "-05:00") => new Date(`${iso}${offset}`);

describe("usMarketSession", () => {
  it("is open 9:30–16:00 ET on weekdays, in both summer and winter time", () => {
    expect(usMarketSession(ny("2026-10-08T09:30", "-04:00"))).toEqual({ open: true }); // Thu, EDT
    expect(usMarketSession(ny("2026-10-08T15:59", "-04:00"))).toEqual({ open: true });
    expect(usMarketSession(ny("2026-12-01T10:00", "-05:00"))).toEqual({ open: true }); // Tue, EST
  });

  it("is closed before the open and from the close", () => {
    expect(usMarketSession(ny("2026-10-08T09:29", "-04:00"))).toEqual({
      open: false,
      reason: "pre-market",
    });
    expect(usMarketSession(ny("2026-10-08T16:00", "-04:00"))).toEqual({
      open: false,
      reason: "after-hours",
    });
    // 14:00 UTC is 9:00 ET in winter (closed) but 10:00 ET in summer (open).
    expect(usMarketSession(new Date("2026-12-01T14:00Z")).open).toBe(false);
    expect(usMarketSession(new Date("2026-10-08T14:00Z")).open).toBe(true);
  });

  it("is closed at weekends and on exchange holidays", () => {
    expect(usMarketSession(ny("2026-10-10T12:00", "-04:00"))).toEqual({
      open: false,
      reason: "weekend",
    });
    expect(usMarketSession(ny("2026-11-26T12:00", "-05:00"))).toEqual({
      open: false,
      reason: "holiday", // Thanksgiving
    });
    expect(usMarketSession(ny("2026-07-03T12:00", "-04:00"))).toEqual({
      open: false,
      reason: "holiday", // Independence Day, observed
    });
  });

  it("explains why it's closed", () => {
    expect(describeClosedMarket("weekend")).toMatch(/^US market closed \(it's the weekend\)/);
  });
});
