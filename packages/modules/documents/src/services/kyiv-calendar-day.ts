import { CoreInvariantError } from "@showzy/core/errors";

const KYIV_TIME_ZONE = "Europe/Kyiv";

function requirePart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const match = parts.find((part) => part.type === type);
  if (match === undefined || match.value === "") {
    throw new CoreInvariantError(
      `Intl Europe/Kyiv formatToParts omitted "${type}"`,
    );
  }
  return match.value;
}

/**
 * Calendar day in `Europe/Kyiv` as `YYYY-MM-DD`. Instant is `new Date()`
 * (or a test-injected Date). Uses `Intl.DateTimeFormat` / `formatToParts`
 * with `timeZone: "Europe/Kyiv"` — not the host timezone and not a UTC
 * calendar day.
 */
export function kyivCalendarDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KYIV_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = requirePart(parts, "year");
  const month = requirePart(parts, "month");
  const day = requirePart(parts, "day");
  return `${year}-${month}-${day}`;
}
