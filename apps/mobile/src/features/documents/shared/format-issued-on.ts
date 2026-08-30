/**
 * Format a Kyiv calendar day (`YYYY-MM-DD` `issuedOn`) for the list.
 * The list field is already a calendar day, not an instant. Use `Intl`
 * with `Europe/Kyiv` — never Date year getters.
 */
import type { Locale } from "../../../i18n/locale";

const ISSUED_ON_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatIssuedOn(issuedOn: string, locale: Locale): string {
  if (!ISSUED_ON_PATTERN.test(issuedOn)) {
    return issuedOn;
  }
  // Noon UTC stays the same calendar day in Europe/Kyiv (UTC+2/+3).
  const date = new Date(`${issuedOn}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return issuedOn;
  }
  const parts = new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (day === undefined || month === undefined || year === undefined) {
    return issuedOn;
  }
  return `${day} ${month} ${year}`;
}
