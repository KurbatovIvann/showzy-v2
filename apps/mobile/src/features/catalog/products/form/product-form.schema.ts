/**
 * UI draft Zod for the product form (SHO-159). Major-unit `priceText`,
 * inherit-empty variant price, caps from `@showzy/validation/catalog`.
 * This is not the catalog action wire schema.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CREATE_PRODUCT_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
} from "@showzy/validation/catalog";
import { z } from "zod";

import { parseMajorUnitsToMinor } from "../../../../format/money-input";

export { CREATE_PRODUCT_MAX_VARIANTS, PRODUCT_NAME_MAX };

export type NameErrorKey = "required" | "too_long";
export type PriceErrorKey = "required" | "invalid";

export type VariantFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly price: PriceErrorKey | null;
};

export type ProductFormFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly price: PriceErrorKey | null;
  readonly variants: Readonly<Record<string, VariantFieldErrors>>;
};

const EMPTY_VARIANT_ERRORS: VariantFieldErrors = { name: null, price: null };

export function emptyFieldErrors(): ProductFormFieldErrors {
  return { name: null, price: null, variants: {} };
}

export function isNameErrorKey(value: string): value is NameErrorKey {
  return value === "required" || value === "too_long";
}

export function isPriceErrorKey(value: string): value is PriceErrorKey {
  return value === "required" || value === "invalid";
}

export const productFormNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { message: "required" })
  .refine((value) => value.trim().length <= PRODUCT_NAME_MAX, {
    message: "too_long",
  });

export const productPriceTextSchema = z
  .string()
  .refine(
    (value) => {
      const parsed = parseMajorUnitsToMinor(value);
      return parsed.ok || parsed.error !== "empty";
    },
    { message: "required" },
  )
  .refine(
    (value) => {
      const parsed = parseMajorUnitsToMinor(value);
      return parsed.ok || parsed.error === "empty";
    },
    { message: "invalid" },
  );

/** Empty variant price means inherit the product price. */
export const variantPriceTextSchema = z.string().refine(
  (value) => {
    if (value.trim().length === 0) {
      return true;
    }
    return parseMajorUnitsToMinor(value).ok;
  },
  { message: "invalid" },
);

export const productFormVariantSchema = z.object({
  key: z.string().min(1),
  variantId: z.string().nullable(),
  name: productFormNameSchema,
  priceText: variantPriceTextSchema,
  archived: z.boolean(),
});

export const productFormDraftSchema = z.object({
  name: productFormNameSchema,
  priceText: productPriceTextSchema,
  variants: z.array(productFormVariantSchema).max(CREATE_PRODUCT_MAX_VARIANTS),
  nextDraftSerial: z.number().int().positive(),
});

export const variantSheetSchema = z
  .object({
    name: productFormNameSchema,
    customPrice: z.boolean(),
    priceText: z.string(),
  })
  .refine(
    (draft) => {
      if (!draft.customPrice) {
        return true;
      }
      const parsed = parseMajorUnitsToMinor(draft.priceText);
      return parsed.ok || parsed.error !== "empty";
    },
    { message: "required", path: ["priceText"] },
  )
  .refine(
    (draft) => {
      if (!draft.customPrice) {
        return true;
      }
      const parsed = parseMajorUnitsToMinor(draft.priceText);
      return parsed.ok || parsed.error === "empty";
    },
    { message: "invalid", path: ["priceText"] },
  );

export const productFormResolver = zodResolver(productFormDraftSchema);
export const variantSheetResolver = zodResolver(variantSheetSchema);

function variantKeyAt(
  variants: ReadonlyArray<{ readonly key: string }>,
  index: number,
): string | null {
  return variants[index]?.key ?? null;
}

/**
 * Map UI-schema issues onto field copy keys. The schema `message` values
 * are keys (`required` / `too_long` / `invalid`), never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
  variants: ReadonlyArray<{ readonly key: string }>,
): ProductFormFieldErrors {
  let name: NameErrorKey | null = null;
  let price: PriceErrorKey | null = null;
  const variantErrors: Record<string, VariantFieldErrors> = {};
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "name" && isNameErrorKey(issue.message)) {
      name = issue.message;
      continue;
    }
    if (root === "priceText" && isPriceErrorKey(issue.message)) {
      price = issue.message;
      continue;
    }
    if (root !== "variants") {
      continue;
    }
    const index = issue.path[1];
    if (typeof index !== "number") {
      continue;
    }
    const key = variantKeyAt(variants, index);
    if (key === null) {
      continue;
    }
    const current = variantErrors[key] ?? EMPTY_VARIANT_ERRORS;
    const field = issue.path[2];
    if (field === "name" && isNameErrorKey(issue.message)) {
      variantErrors[key] = { ...current, name: issue.message };
    }
    if (field === "priceText" && isPriceErrorKey(issue.message)) {
      variantErrors[key] = { ...current, price: issue.message };
    }
  }
  return { name, price, variants: variantErrors };
}

export function variantSheetErrorsFromSchema(
  error: z.ZodError,
): VariantFieldErrors {
  let name: NameErrorKey | null = null;
  let price: PriceErrorKey | null = null;
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "name" && isNameErrorKey(issue.message)) {
      name = issue.message;
    }
    if (root === "priceText" && isPriceErrorKey(issue.message)) {
      price = issue.message;
    }
  }
  return { name, price };
}
