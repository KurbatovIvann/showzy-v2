/**
 * Locale-aware value formatting (not copy — copy lives in `src/i18n/`).
 *
 * Money arrives as a canonical int64 minor-unit wire string
 * (`@showzy/contract` money wire). Formatting is manual bigint math so
 * the output is deterministic across Hermes, Node, and web instead of
 * depending on each engine's `Intl` data: groups of three separated by
 * a no-break space, comma decimal separator, kopiykas omitted when zero
 * (canvas `formatMoney`).
 */
import { moneyFromWire } from "@showzy/contract";

/** Ukrainian-style thousands separator (what `uk-UA` `Intl` emits). */
const GROUP_SEPARATOR = "\u00A0";
const UAH_SYMBOL = "₴";

function groupDigits(digits: string): string {
  let grouped = "";
  for (let index = 0; index < digits.length; index += 1) {
    const fromEnd = digits.length - index;
    if (index > 0 && fromEnd % 3 === 0) {
      grouped += GROUP_SEPARATOR;
    }
    grouped += digits.charAt(index);
  }
  return grouped;
}

/**
 * Format a minor-unit wire string as an amount with its currency
 * marker, e.g. `"123456"` + `"UAH"` → `1 234,56 ₴`. Non-UAH currencies
 * fall back to the ISO code suffix (the catalog is UAH-only today —
 * SHO-132).
 */
export function formatMoneyMinor(wire: string, currency: string): string {
  const minor = moneyFromWire(wire);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const units = absolute / 100n;
  const cents = absolute % 100n;
  const sign = negative ? "−" : "";
  const grouped = groupDigits(units.toString(10));
  const fraction =
    cents === 0n ? "" : `,${cents.toString(10).padStart(2, "0")}`;
  const marker = currency === "UAH" ? UAH_SYMBOL : currency;
  return `${sign}${grouped}${fraction}${GROUP_SEPARATOR}${marker}`;
}
