/**
 * Product form copy keys and server VALIDATION-by-path mapping (SHO-163).
 * Schema `message` values and issue paths are keys, never user-facing text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../../api/errors";
import type { ProductsFormCopy } from "../../../../i18n/products";
import type { ProductFormMode } from "./product-form-draft";
import type { ProductFormWrite } from "./product-form-plan";
import {
  isNameErrorKey,
  isPriceErrorKey,
  type NameErrorKey,
  type PriceErrorKey,
  type ProductFormFieldErrors,
  type VariantFieldErrors,
} from "./product-form.schema";

export type BannerKey =
  | "validation"
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "too_many_variants";

const EMPTY_VARIANT_ERRORS: VariantFieldErrors = { name: null, price: null };

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapProductFormFailure(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): BannerKey | null {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return "unavailable";
  }
  if (kind === null) {
    return null;
  }
  if (kind === "permission") {
    return "permission";
  }
  if (kind === "validation") {
    return "validation";
  }
  if (kind === "network") {
    return "network";
  }
  if (kind === "offline") {
    return "offline";
  }
  return "unavailable";
}

type IssuePath = ReadonlyArray<string | number>;

function issueTarget(
  write: ProductFormWrite,
  path: IssuePath,
): {
  readonly name?: true;
  readonly price?: true;
  readonly variantKey?: string;
} | null {
  const field = path[0];
  if (field === "name") {
    if (write.kind === "createVariant" || write.kind === "updateVariant") {
      return { variantKey: write.key, name: true };
    }
    return { name: true };
  }
  if (field === "basePriceMinor" || field === "currency") {
    if (write.kind === "createVariant" || write.kind === "updateVariant") {
      return { variantKey: write.key, price: true };
    }
    return { price: true };
  }
  if (field === "variants" && write.kind === "createProduct") {
    const index = path[1];
    if (typeof index !== "number") {
      return null;
    }
    const key = write.variantKeys[index];
    if (key === undefined) {
      return null;
    }
    const nested = path[2];
    if (nested === "name") {
      return { variantKey: key, name: true };
    }
    if (nested === "basePriceMinor" || nested === "currency") {
      return { variantKey: key, price: true };
    }
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: ProductFormWrite | null,
): ProductFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let name: NameErrorKey | null = null;
  let price: PriceErrorKey | null = null;
  const variants: Record<string, VariantFieldErrors> = {};
  for (const issue of error.data.issues) {
    const target = issueTarget(write, issue.path);
    if (target === null) {
      continue;
    }
    if (target.variantKey !== undefined) {
      const current = variants[target.variantKey] ?? EMPTY_VARIANT_ERRORS;
      variants[target.variantKey] = {
        name: target.name === true ? "required" : current.name,
        price: target.price === true ? "invalid" : current.price,
      };
      continue;
    }
    if (target.name === true) {
      name = "required";
    }
    if (target.price === true) {
      price = "invalid";
    }
  }
  if (name === null && price === null && Object.keys(variants).length === 0) {
    return null;
  }
  return { name, price, variants };
}

/**
 * Map RHF `formState.errors.variants` (indexed rows) onto draft keys.
 * Schema `message` values stay copy keys. Does not import RHF types.
 */
export function mapRhfVariantFieldErrors(
  variants: ReadonlyArray<{ readonly key: string }>,
  rhfVariants: object | undefined,
): Record<string, VariantFieldErrors> {
  if (rhfVariants === undefined) {
    return {};
  }
  const mapped: Record<string, VariantFieldErrors> = {};
  for (let index = 0; index < variants.length; index += 1) {
    const key = variants[index]?.key;
    if (key === undefined) {
      continue;
    }
    const row = Reflect.get(rhfVariants, index);
    if (row === null || typeof row !== "object") {
      continue;
    }
    const nameMessage = rhfMessage(Reflect.get(row, "name"));
    const priceMessage = rhfMessage(Reflect.get(row, "priceText"));
    const name =
      nameMessage !== undefined && isNameErrorKey(nameMessage)
        ? nameMessage
        : null;
    const price =
      priceMessage !== undefined && isPriceErrorKey(priceMessage)
        ? priceMessage
        : null;
    if (name !== null || price !== null) {
      mapped[key] = { name, price };
    }
  }
  return mapped;
}

function rhfMessage(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const message = Reflect.get(value, "message");
  return typeof message === "string" ? message : undefined;
}

/**
 * Later layers win on a field when they carry a non-null key. Sparse
 * overlays (RHF name-only) keep the previous price on the same row.
 */
export function overlayVariantFieldErrors(
  ...layers: ReadonlyArray<
    Readonly<Record<string, VariantFieldErrors>> | undefined
  >
): Record<string, VariantFieldErrors> {
  const mapped: Record<string, VariantFieldErrors> = {};
  for (const layer of layers) {
    if (layer === undefined) {
      continue;
    }
    for (const [key, row] of Object.entries(layer)) {
      const previous = mapped[key] ?? EMPTY_VARIANT_ERRORS;
      mapped[key] = {
        name: row.name ?? previous.name,
        price: row.price ?? previous.price,
      };
    }
  }
  return mapped;
}

function nameErrorCopy(
  copy: ProductsFormCopy,
  key: NameErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.nameRequired;
  }
  if (key === "too_long") {
    return copy.errors.nameTooLong;
  }
  return null;
}

function priceErrorCopy(
  copy: ProductsFormCopy,
  key: PriceErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.priceRequired;
  }
  if (key === "invalid") {
    return copy.errors.priceInvalid;
  }
  return null;
}

export function resolveProductFormCopy(
  copy: ProductsFormCopy,
  args: {
    readonly mode: ProductFormMode;
    readonly nameError: NameErrorKey | null;
    readonly priceError: PriceErrorKey | null;
    readonly variantErrors: Readonly<Record<string, VariantFieldErrors>>;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
  },
): {
  readonly nameError: string | null;
  readonly priceError: string | null;
  readonly variantErrors: Readonly<
    Record<
      string,
      { readonly name: string | null; readonly price: string | null }
    >
  >;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  const variantErrors: Record<
    string,
    { readonly name: string | null; readonly price: string | null }
  > = {};
  for (const [key, errors] of Object.entries(args.variantErrors)) {
    variantErrors[key] = {
      name: nameErrorCopy(copy, errors.name),
      price: priceErrorCopy(copy, errors.price),
    };
  }
  const banner =
    args.banner === null
      ? null
      : args.banner === "too_many_variants"
        ? copy.errors.tooManyVariants
        : copy.errors[args.banner];
  return {
    nameError: nameErrorCopy(copy, args.nameError),
    priceError: priceErrorCopy(copy, args.priceError),
    variantErrors,
    banner: args.clientReady ? banner : copy.errors.unavailable,
    submitLabel:
      args.mode === "create"
        ? args.pending
          ? copy.submitCreateLoading
          : copy.submitCreate
        : args.pending
          ? copy.submitEditLoading
          : copy.submitEdit,
    submitDisabled: args.pending || !args.clientReady,
    fieldsEditable: !args.pending && args.clientReady,
  };
}

export function firstVariantFieldError(
  errors:
    { readonly name: string | null; readonly price: string | null } | undefined,
): string | null {
  if (errors === undefined) {
    return null;
  }
  if (errors.name !== null && errors.name.length > 0) {
    return errors.name;
  }
  if (errors.price !== null && errors.price.length > 0) {
    return errors.price;
  }
  return null;
}
