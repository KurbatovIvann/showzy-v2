/**
 * UI draft Zod for the price-list editor (SHO-190). Name cap from the
 * create/update contracts. Empty price text is inherit/remove; `"0"` is
 * a stored price. This is not the pricing action wire schema.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { parseMajorUnitsToMinor } from "../../../format/money-input";
import { PRICE_LIST_NAME_MAX } from "../shared/price-list-caps";

export { PRICE_LIST_NAME_MAX };

export type NameErrorKey = "required" | "too_long";
export type PriceErrorKey = "invalid";

export type PriceListFormFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly entries: Readonly<Record<string, PriceErrorKey>>;
};

export function emptyFieldErrors(): PriceListFormFieldErrors {
  return { name: null, entries: {} };
}

export function isNameErrorKey(value: string): value is NameErrorKey {
  return value === "required" || value === "too_long";
}

export function isPriceErrorKey(value: string): value is PriceErrorKey {
  return value === "invalid";
}

export const priceListFormNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { message: "required" })
  .refine((value) => value.trim().length <= PRICE_LIST_NAME_MAX, {
    message: "too_long",
  });

/** Empty = inherit (no entry). `"0"` parses as a real minor-unit price. */
export const priceListPriceTextSchema = z.string().refine(
  (value) => {
    if (value.trim().length === 0) {
      return true;
    }
    return parseMajorUnitsToMinor(value).ok;
  },
  { message: "invalid" },
);

export const priceListEntryDraftSchema = z.object({
  key: z.string().min(1),
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  priceText: priceListPriceTextSchema,
});

export const priceListFormDraftSchema = z.object({
  name: priceListFormNameSchema,
  isDefault: z.boolean(),
  isActive: z.boolean(),
  entries: z.array(priceListEntryDraftSchema),
});

export const priceListFormResolver = zodResolver(priceListFormDraftSchema);

function entryKeyAt(
  entries: ReadonlyArray<{ readonly key: string }>,
  index: number,
): string | null {
  return entries[index]?.key ?? null;
}

/**
 * Map UI-schema issues onto field copy keys. Schema `message` values
 * are keys (`required` / `too_long` / `invalid`), never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
  entries: ReadonlyArray<{ readonly key: string }>,
): PriceListFormFieldErrors {
  let name: NameErrorKey | null = null;
  const entryErrors: Record<string, PriceErrorKey> = {};
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "name" && isNameErrorKey(issue.message)) {
      name = issue.message;
      continue;
    }
    if (root !== "entries") {
      continue;
    }
    const index = issue.path[1];
    if (typeof index !== "number") {
      continue;
    }
    const key = entryKeyAt(entries, index);
    if (key === null) {
      continue;
    }
    if (issue.path[2] === "priceText" && isPriceErrorKey(issue.message)) {
      entryErrors[key] = issue.message;
    }
  }
  return { name, entries: entryErrors };
}
