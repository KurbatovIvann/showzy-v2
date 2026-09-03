/**
 * Locale-aware order `createdAt` for list rows and assistant list cards
 * (canvas `d MMM yyyy`, no date-fns). Same helper for `/orders` and T2.
 */
import type { Locale } from "../../../i18n/locale";

const UK_MONTHS = [
  "січ.",
  "лют.",
  "бер.",
  "квіт.",
  "трав.",
  "черв.",
  "лип.",
  "серп.",
  "вер.",
  "жовт.",
  "лист.",
  "груд.",
] as const;

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Local calendar date. Invalid or empty ISO → empty string. */
export function formatOrderCreatedAt(iso: string, locale: Locale): string {
  if (iso.length === 0) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const months = locale === "uk" ? UK_MONTHS : EN_MONTHS;
  const monthLabel = months[month];
  if (monthLabel === undefined) {
    return "";
  }
  return `${String(day)} ${monthLabel} ${String(year)}`;
}
