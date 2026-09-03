/**
 * Format an order total from the money wire string. Domain minor units
 * come from `moneyFromWire` only (`@showzy/contract` — there is no
 * `@showzy/money` package). Feature-local; not a global store.
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
 * marker, e.g. `"123456"` + `"UAH"` → `1 234,56 ₴`.
 */
export function formatOrderMoney(wire: string, currency: string): string {
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
