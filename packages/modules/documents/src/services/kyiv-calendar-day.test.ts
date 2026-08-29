import { describe, expect, it } from "vitest";

import { kyivCalendarDay } from "./kyiv-calendar-day.js";

describe("kyivCalendarDay", () => {
  it("returns the Europe/Kyiv calendar day, not the UTC date, around the Kyiv midnight", () => {
    // August is EEST (UTC+3). 20:30Z is still 23:30 Kyiv on the 29th;
    // 21:30Z is 00:30 Kyiv on the 30th.
    expect(kyivCalendarDay(new Date("2026-08-29T20:30:00.000Z"))).toBe(
      "2026-08-29",
    );
    expect(kyivCalendarDay(new Date("2026-08-29T21:30:00.000Z"))).toBe(
      "2026-08-30",
    );
  });
});
