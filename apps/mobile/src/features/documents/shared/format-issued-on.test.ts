import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatIssuedOn } from "./format-issued-on";

const SOURCE = readFileSync(
  new URL("./format-issued-on.ts", import.meta.url),
  "utf8",
);

describe("formatIssuedOn", () => {
  it("formats a Kyiv calendar day with Intl, not getFullYear", () => {
    expect(SOURCE).not.toContain("getFullYear");
    expect(SOURCE).not.toContain("getUTCFullYear");
    expect(SOURCE).toContain("Europe/Kyiv");
    expect(SOURCE).toContain("formatToParts");

    const uk = formatIssuedOn("2026-08-29", "uk");
    expect(uk).toContain("29");
    expect(uk).toContain("2026");
    const en = formatIssuedOn("2026-08-29", "en");
    expect(en).toContain("29");
    expect(en).toContain("2026");
  });

  it("returns the original string when the calendar day is not YYYY-MM-DD", () => {
    expect(formatIssuedOn("not-a-day", "uk")).toBe("not-a-day");
  });
});
