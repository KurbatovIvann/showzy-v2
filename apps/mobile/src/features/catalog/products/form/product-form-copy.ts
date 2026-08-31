/**
 * Product form copy keys, formState mapping, and server VALIDATION-by-path
 * mapping (SHO-163 / SHO-168). Schema `message` values and issue paths
 * are keys, never user-facing text. Field errors live in RHF formState
 * plus this mapper — not a parallel `clientErrors` store.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import {
  describeQueryFailure,
  describeWireError,
  type QueryFailureKind,
} from "../../../../api/errors";
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
  rhfVariants: unknown,
): Record<string, VariantFieldErrors> {
  const mapped: Record<string, VariantFieldErrors> = {};
  for (let index = 0; index < variants.length; index += 1) {
    const key = variants[index]?.key;
    if (key === undefined) {
      continue;
    }
    const row = rhfRowAt(rhfVariants, index);
    const nameMessage = rhfFieldMessage(row, "name");
    const priceMessage = rhfFieldMessage(row, "priceText");
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

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rhfRowAt(source: unknown, index: number): unknown {
  if (Array.isArray(source)) {
    return source[index];
  }
  if (isUnknownRecord(source)) {
    return source[String(index)];
  }
  return undefined;
}

function rhfFieldMessage(
  row: unknown,
  field: "name" | "priceText",
): string | undefined {
  if (!isUnknownRecord(row)) {
    return undefined;
  }
  const nested = row[field];
  if (!isUnknownRecord(nested)) {
    return undefined;
  }
  const message = nested.message;
  return typeof message === "string" ? message : undefined;
}

/**
 * Parent + variant-row errors after submit: RHF `formState` copy keys,
 * then wire `VALIDATION` issues on the same shape. Does not take a
 * parallel `clientErrors` store.
 */
export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly priceMessage: unknown;
  readonly variants: ReadonlyArray<{ readonly key: string }>;
  readonly rhfVariants: unknown;
  readonly server: ProductFormFieldErrors | null;
}): ProductFormFieldErrors {
  const name =
    args.submitted &&
    typeof args.nameMessage === "string" &&
    isNameErrorKey(args.nameMessage)
      ? args.nameMessage
      : null;
  const price =
    args.submitted &&
    typeof args.priceMessage === "string" &&
    isPriceErrorKey(args.priceMessage)
      ? args.priceMessage
      : null;
  return {
    name: name ?? args.server?.name ?? null,
    price: price ?? args.server?.price ?? null,
    variants: overlayVariantFieldErrors(
      args.server?.variants,
      args.submitted
        ? mapRhfVariantFieldErrors(args.variants, args.rhfVariants)
        : undefined,
    ),
  };
}

export type ProductFormRhfErrorEntry = {
  readonly name:
    | "name"
    | "priceText"
    | `variants.${number}.name`
    | `variants.${number}.priceText`;
  readonly message: NameErrorKey | PriceErrorKey;
};

function variantRhfPath(
  index: number,
  field: "name" | "priceText",
): `variants.${number}.name` | `variants.${number}.priceText` {
  const indexText = String(index);
  if (field === "name") {
    return `variants.${indexText}.name` as `variants.${number}.name`;
  }
  return `variants.${indexText}.priceText` as `variants.${number}.priceText`;
}

/**
 * Planner `invalid` field errors → RHF `setError` names. Does not import
 * RHF types. `String(index)` keeps template expressions lint-clean.
 */
export function rhfPathsForFieldErrors(
  errors: ProductFormFieldErrors,
  variants: ReadonlyArray<{ readonly key: string }>,
): readonly ProductFormRhfErrorEntry[] {
  const paths: ProductFormRhfErrorEntry[] = [];
  if (errors.name !== null) {
    paths.push({ name: "name", message: errors.name });
  }
  if (errors.price !== null) {
    paths.push({ name: "priceText", message: errors.price });
  }
  const indexByKey = new Map(
    variants.map((variant, index) => [variant.key, index]),
  );
  for (const [key, row] of Object.entries(errors.variants)) {
    const index = indexByKey.get(key);
    if (index === undefined) {
      continue;
    }
    if (row.name !== null) {
      paths.push({ name: variantRhfPath(index, "name"), message: row.name });
    }
    if (row.price !== null) {
      paths.push({
        name: variantRhfPath(index, "priceText"),
        message: row.price,
      });
    }
  }
  return paths;
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

export type ProductFormResolvedCopy = ReturnType<typeof resolveProductFormCopy>;

/**
 * fieldErrorsFromFormState → banner map → resolveProductFormCopy.
 * Composer stays a thin caller (SHO-303).
 */
export function resolveProductFormPresentation(args: {
  readonly copy: ProductsFormCopy;
  readonly mode: ProductFormMode;
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly priceMessage: unknown;
  readonly variants: ReadonlyArray<{ readonly key: string }>;
  readonly rhfVariants: unknown;
  readonly localBanner: BannerKey | null;
  readonly mutationError: unknown | null;
  readonly lastWrite: ProductFormWrite | null;
  readonly pending: boolean;
  readonly clientReady: boolean;
}): ProductFormResolvedCopy {
  const server =
    args.mutationError === null
      ? null
      : mapValidationIssues(args.mutationError, args.lastWrite);
  const failureKind =
    args.mutationError === null
      ? null
      : describeQueryFailure(args.mutationError).kind;
  const wireCode =
    args.mutationError === null
      ? null
      : (describeWireError(args.mutationError)?.code ?? null);
  const fieldErrors = fieldErrorsFromFormState({
    submitted: args.submitted,
    nameMessage: args.nameMessage,
    priceMessage: args.priceMessage,
    variants: args.variants,
    rhfVariants: args.rhfVariants,
    server,
  });
  return resolveProductFormCopy(args.copy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    priceError: fieldErrors.price,
    variantErrors: fieldErrors.variants,
    banner: args.localBanner ?? mapProductFormFailure(failureKind, wireCode),
    pending: args.pending,
    clientReady: args.clientReady,
  });
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
