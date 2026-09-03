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

const QUANTITY_MILLI_SCALE = 1000n;
const QUANTITY_WIRE = /^[1-9][0-9]*$/;

/**
 * Quantity milli is scale 3 (`1000` = 1). Trailing zeros after the
 * comma are omitted so `1000` → `1` and `1500` → `1,5`.
 */
export function formatOrderQuantityMilli(wire: string): string {
  if (!QUANTITY_WIRE.test(wire)) {
    throw new TypeError("Expected a canonical positive integer string");
  }
  const milli = BigInt(wire);
  const units = milli / QUANTITY_MILLI_SCALE;
  const remainder = milli % QUANTITY_MILLI_SCALE;
  const grouped = groupDigits(units.toString(10));
  if (remainder === 0n) {
    return grouped;
  }
  const fraction = remainder.toString(10).padStart(3, "0").replace(/0+$/, "");
  return `${grouped},${fraction}`;
}
