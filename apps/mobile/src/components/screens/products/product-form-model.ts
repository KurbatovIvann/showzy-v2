/**
 * Pure view-model for the create/edit product form (SHO-139). No React
 * Native imports so money conversion, validation mapping, and the
 * write plan are unit-testable.
 */
import { isWireError, moneyToWire, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import { formatMoneyMinor } from "../../../format/money";
import {
  formatMajorUnitsFromMinor,
  parseMajorUnitsToMinor,
} from "../../../format/money-input";
import type { ProductsFormCopy } from "../../../i18n/products";
import { classifyProductDetail } from "./product-detail-model";
import type { GetProductOutput } from "./product-detail-query";

/** Matches `catalog.createProduct` name cap / companies.create. */
export const PRODUCT_NAME_MAX = 120;

/** Line-item-style ceiling copied from `catalog.createProduct`. */
export const PRODUCT_FORM_MAX_VARIANTS = 100;

export const PRODUCT_CURRENCY = "UAH" as const;

export type ProductFormMode = "create" | "edit";

export type ProductFormVariantDraft = {
  readonly key: string;
  readonly variantId: string | null;
  readonly name: string;
  readonly priceText: string;
  readonly archived: boolean;
};

export type ProductFormDraft = {
  readonly name: string;
  readonly priceText: string;
  readonly variants: readonly ProductFormVariantDraft[];
  readonly nextDraftSerial: number;
};

export type VariantSnapshot = {
  readonly key: string;
  readonly variantId: string | null;
  readonly name: string;
  readonly priceMinor: string | null;
};

export type ProductFormSnapshot = {
  readonly name: string;
  readonly priceMinor: string;
  readonly variants: readonly VariantSnapshot[];
};

export type NameErrorKey = "required" | "too_long";
export type PriceErrorKey = "required" | "invalid";
export type BannerKey =
  | "validation"
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "too_many_variants";

export type VariantFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly price: PriceErrorKey | null;
};

export type ProductFormFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly price: PriceErrorKey | null;
  readonly variants: Readonly<Record<string, VariantFieldErrors>>;
};

export type CreateProductPayload = {
  readonly name: string;
  readonly basePriceMinor: string;
  readonly currency: typeof PRODUCT_CURRENCY;
  readonly variants?: Array<{
    readonly name: string;
    readonly basePriceMinor?: string;
    readonly currency?: typeof PRODUCT_CURRENCY;
  }>;
};

export type UpdateProductPayload = {
  readonly productId: string;
  readonly name: string;
  readonly basePriceMinor: string;
  readonly currency: typeof PRODUCT_CURRENCY;
};

export type CreateVariantPayload = {
  readonly productId: string;
  readonly name: string;
  readonly basePriceMinor?: string;
  readonly currency?: typeof PRODUCT_CURRENCY;
};

export type UpdateVariantPayload = {
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly basePriceMinor?: string;
  readonly currency?: typeof PRODUCT_CURRENCY;
};

export type ProductFormWrite =
  | {
      readonly kind: "createProduct";
      readonly input: CreateProductPayload;
      readonly variantKeys: readonly string[];
    }
  | { readonly kind: "updateProduct"; readonly input: UpdateProductPayload }
  | {
      readonly kind: "createVariant";
      readonly key: string;
      readonly input: CreateVariantPayload;
    }
  | {
      readonly kind: "updateVariant";
      readonly key: string;
      readonly input: UpdateVariantPayload;
    };

export type ProductFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: ProductFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "noop" }
  | { readonly kind: "write"; readonly write: ProductFormWrite };

export type ProductFormMutationResult =
  | { readonly kind: "product"; readonly productId: string }
  | { readonly kind: "variant"; readonly variantId: string };

const EMPTY_VARIANT_ERRORS: VariantFieldErrors = { name: null, price: null };

const RETRYABLE_FAILURE: ReadonlySet<QueryFailureKind> = new Set([
  "network",
  "offline",
  "timeout",
  "rate_limited",
  "internal",
]);

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function emptyProductFormDraft(): ProductFormDraft {
  return { name: "", priceText: "", variants: [], nextDraftSerial: 1 };
}

export function emptyFieldErrors(): ProductFormFieldErrors {
  return { name: null, price: null, variants: {} };
}

export function draftFromProduct(product: GetProductOutput): ProductFormDraft {
  return {
    name: product.name,
    priceText: formatMajorUnitsFromMinor(product.basePriceMinor),
    variants: product.variants.map((variant) => ({
      key: variant.id,
      variantId: variant.id,
      name: variant.name,
      priceText:
        variant.basePriceMinor === null
          ? ""
          : formatMajorUnitsFromMinor(variant.basePriceMinor),
      archived: variant.status === "archived",
    })),
    nextDraftSerial: 1,
  };
}

/** Server snapshot for dirty detection — trims names like `snapshotFromDraft`. */
export function snapshotFromProduct(
  product: GetProductOutput,
): ProductFormSnapshot {
  return {
    name: product.name.trim(),
    priceMinor: product.basePriceMinor,
    variants: product.variants.map((variant) => ({
      key: variant.id,
      variantId: variant.id,
      name: variant.name.trim(),
      priceMinor: variant.basePriceMinor,
    })),
  };
}

export function addVariantRow(draft: ProductFormDraft): ProductFormDraft {
  if (draft.variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
    return draft;
  }
  const key = `draft-${String(draft.nextDraftSerial)}`;
  return {
    ...draft,
    nextDraftSerial: draft.nextDraftSerial + 1,
    variants: [
      ...draft.variants,
      {
        key,
        variantId: null,
        name: "",
        priceText: "",
        archived: false,
      },
    ],
  };
}

export function removeVariantRow(
  draft: ProductFormDraft,
  key: string,
): ProductFormDraft {
  const target = draft.variants.find((variant) => variant.key === key);
  if (target === undefined || target.variantId !== null) {
    return draft;
  }
  return {
    ...draft,
    variants: draft.variants.filter((variant) => variant.key !== key),
  };
}

export function patchDraft(
  draft: ProductFormDraft,
  patch: {
    readonly name?: string;
    readonly priceText?: string;
    readonly variantKey?: string;
    readonly variantName?: string;
    readonly variantPriceText?: string;
  },
): ProductFormDraft {
  if (patch.variantKey !== undefined) {
    return {
      ...draft,
      variants: draft.variants.map((variant) => {
        if (variant.key !== patch.variantKey) {
          return variant;
        }
        return {
          ...variant,
          name: patch.variantName ?? variant.name,
          priceText: patch.variantPriceText ?? variant.priceText,
        };
      }),
    };
  }
  return {
    ...draft,
    name: patch.name ?? draft.name,
    priceText: patch.priceText ?? draft.priceText,
  };
}

function isBlankUnsavedVariant(variant: ProductFormVariantDraft): boolean {
  return (
    variant.variantId === null &&
    variant.name.trim().length === 0 &&
    variant.priceText.trim().length === 0
  );
}

export function compactDraft(draft: ProductFormDraft): ProductFormDraft {
  return {
    ...draft,
    variants: draft.variants.filter(
      (variant) => !isBlankUnsavedVariant(variant),
    ),
  };
}

export type VariantSheetDraft = {
  readonly name: string;
  readonly customPrice: boolean;
  readonly priceText: string;
};

export function variantDraftToSheet(
  variant: ProductFormVariantDraft | null,
): VariantSheetDraft {
  if (variant === null) {
    return { name: "", customPrice: false, priceText: "" };
  }
  return {
    name: variant.name,
    customPrice: variant.priceText.trim().length > 0,
    priceText: variant.priceText,
  };
}

export function variantSheetPriceText(draft: VariantSheetDraft): string {
  return draft.customPrice ? draft.priceText : "";
}

export function validateVariantSheet(
  draft: VariantSheetDraft,
): VariantFieldErrors {
  return {
    name: nameError(draft.name),
    price: draft.customPrice ? productPriceError(draft.priceText) : null,
  };
}

export function isVariantSheetValid(errors: VariantFieldErrors): boolean {
  return errors.name === null && errors.price === null;
}

export function upsertVariantDraft(
  draft: ProductFormDraft,
  args: {
    readonly key: string | null;
    readonly name: string;
    readonly priceText: string;
  },
): ProductFormDraft {
  if (args.key === null) {
    if (draft.variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
      return draft;
    }
    const added = addVariantRow(draft);
    const created = added.variants[added.variants.length - 1];
    if (created === undefined) {
      return draft;
    }
    return patchDraft(added, {
      variantKey: created.key,
      variantName: args.name,
      variantPriceText: args.priceText,
    });
  }
  return patchDraft(draft, {
    variantKey: args.key,
    variantName: args.name,
    variantPriceText: args.priceText,
  });
}

export function isProductFormDirty(
  draft: ProductFormDraft,
  origin: ProductFormDraft,
): boolean {
  if (draft.name !== origin.name || draft.priceText !== origin.priceText) {
    return true;
  }
  const left = compactDraft(draft).variants;
  const right = compactDraft(origin).variants;
  if (left.length !== right.length) {
    return true;
  }
  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const previous = right[index];
    if (current === undefined || previous === undefined) {
      return true;
    }
    if (
      current.key !== previous.key ||
      current.variantId !== previous.variantId ||
      current.name !== previous.name ||
      current.priceText !== previous.priceText
    ) {
      return true;
    }
  }
  return false;
}

export function productFormFieldChanged(
  mode: ProductFormMode,
  current: string,
  origin: string,
): boolean {
  return mode === "edit" && current !== origin;
}

export function formatProductFormFooterPrice(priceText: string): string {
  const parsed = parseMajorUnitsToMinor(priceText);
  if (!parsed.ok) {
    return formatMoneyMinor("0", PRODUCT_CURRENCY);
  }
  return formatMoneyMinor(moneyToWire(parsed.minor), PRODUCT_CURRENCY);
}

function nameError(name: string): NameErrorKey | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "required";
  }
  if (trimmed.length > PRODUCT_NAME_MAX) {
    return "too_long";
  }
  return null;
}

function productPriceError(text: string): PriceErrorKey | null {
  const parsed = parseMajorUnitsToMinor(text);
  if (!parsed.ok) {
    return parsed.error === "empty" ? "required" : "invalid";
  }
  return null;
}

function overridePriceError(text: string): PriceErrorKey | null {
  if (text.trim().length === 0) {
    return null;
  }
  const parsed = parseMajorUnitsToMinor(text);
  return parsed.ok ? null : "invalid";
}

export function validateProductForm(
  draft: ProductFormDraft,
): ProductFormFieldErrors {
  const compacted = compactDraft(draft);
  const variants: Record<string, VariantFieldErrors> = {};
  for (const variant of compacted.variants) {
    const name = nameError(variant.name);
    const price = overridePriceError(variant.priceText);
    if (name !== null || price !== null) {
      variants[variant.key] = { name, price };
    }
  }
  return {
    name: nameError(compacted.name),
    price: productPriceError(compacted.priceText),
    variants,
  };
}

export function isProductFormValid(errors: ProductFormFieldErrors): boolean {
  if (errors.name !== null || errors.price !== null) {
    return false;
  }
  return Object.values(errors.variants).every(
    (variant) => variant.name === null && variant.price === null,
  );
}

export function snapshotFromDraft(
  draft: ProductFormDraft,
): ProductFormSnapshot | null {
  const compacted = compactDraft(draft);
  const errors = validateProductForm(compacted);
  if (!isProductFormValid(errors)) {
    return null;
  }
  const price = parseMajorUnitsToMinor(compacted.priceText);
  if (!price.ok) {
    return null;
  }
  return {
    name: compacted.name.trim(),
    priceMinor: moneyToWire(price.minor),
    variants: compacted.variants.map((variant) => {
      const parsed = parseMajorUnitsToMinor(variant.priceText);
      return {
        key: variant.key,
        variantId: variant.variantId,
        name: variant.name.trim(),
        priceMinor: parsed.ok ? moneyToWire(parsed.minor) : null,
      };
    }),
  };
}

function variantPayloadFields(priceMinor: string | null): {
  readonly basePriceMinor?: string;
  readonly currency?: typeof PRODUCT_CURRENCY;
} {
  if (priceMinor === null) {
    return {};
  }
  return { basePriceMinor: priceMinor, currency: PRODUCT_CURRENCY };
}

export function createProductPayload(draft: ProductFormDraft): {
  readonly input: CreateProductPayload;
  readonly variantKeys: readonly string[];
} | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  const variants = snapshot.variants.map((variant) => ({
    name: variant.name,
    ...variantPayloadFields(variant.priceMinor),
  }));
  return {
    variantKeys: snapshot.variants.map((variant) => variant.key),
    input: {
      name: snapshot.name,
      basePriceMinor: snapshot.priceMinor,
      currency: PRODUCT_CURRENCY,
      ...(variants.length === 0 ? {} : { variants }),
    },
  };
}

export function remainingFormWrites(
  productId: string,
  snapshot: ProductFormSnapshot,
  baseline: ProductFormSnapshot,
): readonly ProductFormWrite[] {
  const writes: ProductFormWrite[] = [];
  if (
    snapshot.name !== baseline.name ||
    snapshot.priceMinor !== baseline.priceMinor
  ) {
    writes.push({
      kind: "updateProduct",
      input: {
        productId,
        name: snapshot.name,
        basePriceMinor: snapshot.priceMinor,
        currency: PRODUCT_CURRENCY,
      },
    });
  }
  const baselineByKey = new Map(
    baseline.variants.map((variant) => [variant.key, variant]),
  );
  for (const variant of snapshot.variants) {
    const previous = baselineByKey.get(variant.key);
    if (variant.variantId === null) {
      writes.push({
        kind: "createVariant",
        key: variant.key,
        input: {
          productId,
          name: variant.name,
          ...variantPayloadFields(variant.priceMinor),
        },
      });
      continue;
    }
    if (
      previous !== undefined &&
      previous.name === variant.name &&
      previous.priceMinor === variant.priceMinor
    ) {
      continue;
    }
    writes.push({
      kind: "updateVariant",
      key: variant.key,
      input: {
        productId,
        variantId: variant.variantId,
        name: variant.name,
        ...variantPayloadFields(variant.priceMinor),
      },
    });
  }
  return writes;
}

export function writesEqual(
  left: ProductFormWrite,
  right: ProductFormWrite,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case "createProduct":
      return (
        right.kind === "createProduct" &&
        JSON.stringify(left.input) === JSON.stringify(right.input)
      );
    case "updateProduct":
      return (
        right.kind === "updateProduct" &&
        JSON.stringify(left.input) === JSON.stringify(right.input)
      );
    case "createVariant":
      return (
        right.kind === "createVariant" &&
        left.key === right.key &&
        JSON.stringify(left.input) === JSON.stringify(right.input)
      );
    case "updateVariant":
      return (
        right.kind === "updateVariant" &&
        left.key === right.key &&
        JSON.stringify(left.input) === JSON.stringify(right.input)
      );
  }
}

export function isProductFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function planProductFormSave(args: {
  readonly mode: ProductFormMode;
  readonly productId: string | null;
  readonly draft: ProductFormDraft;
  readonly baseline: ProductFormSnapshot | null;
  readonly lastWrite: ProductFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): ProductFormSavePlan {
  const compacted = compactDraft(args.draft);
  if (compacted.variants.length > PRODUCT_FORM_MAX_VARIANTS) {
    return { kind: "invalid", errors: validateProductForm(compacted) };
  }
  const errors = validateProductForm(compacted);
  if (!isProductFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const retryable = isProductFormRetryable(
    args.lastFailureKind,
    args.lastWireCode ?? null,
  );
  if (args.mode === "create") {
    const created = createProductPayload(compacted);
    if (created === null) {
      return { kind: "invalid", errors };
    }
    const write: ProductFormWrite = {
      kind: "createProduct",
      input: created.input,
      variantKeys: created.variantKeys,
    };
    if (
      args.lastWrite !== null &&
      writesEqual(args.lastWrite, write) &&
      retryable
    ) {
      return { kind: "retry" };
    }
    return { kind: "write", write };
  }
  if (args.productId === null || args.baseline === null) {
    return { kind: "invalid", errors };
  }
  const snapshot = snapshotFromDraft(compacted);
  if (snapshot === null) {
    return { kind: "invalid", errors };
  }
  const writes = remainingFormWrites(args.productId, snapshot, args.baseline);
  if (writes.length === 0) {
    return { kind: "noop" };
  }
  const write = writes[0];
  if (write === undefined) {
    return { kind: "noop" };
  }
  if (
    args.lastWrite !== null &&
    writesEqual(args.lastWrite, write) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  return { kind: "write", write };
}

function writeProductId(write: ProductFormWrite): string | null {
  switch (write.kind) {
    case "createProduct":
      return null;
    case "updateProduct":
    case "createVariant":
    case "updateVariant":
      return write.input.productId;
  }
}

export function applyWriteSuccess(args: {
  readonly draft: ProductFormDraft;
  readonly baseline: ProductFormSnapshot | null;
  readonly write: ProductFormWrite;
  readonly result: ProductFormMutationResult;
}): {
  readonly draft: ProductFormDraft;
  readonly baseline: ProductFormSnapshot | null;
  readonly done: boolean;
} {
  if (args.write.kind === "createProduct") {
    return { draft: args.draft, baseline: args.baseline, done: true };
  }
  const loaded = snapshotFromDraft(args.draft);
  let draft = args.draft;
  let baseline: ProductFormSnapshot = args.baseline ??
    loaded ?? {
      name: "",
      priceMinor: "0",
      variants: [],
    };

  if (args.write.kind === "updateProduct") {
    const write = args.write;
    baseline = {
      ...baseline,
      name: write.input.name,
      priceMinor: write.input.basePriceMinor,
    };
  } else if (args.write.kind === "createVariant") {
    const write = args.write;
    const newId =
      args.result.kind === "variant" ? args.result.variantId : write.key;
    draft = {
      ...draft,
      variants: draft.variants.map((variant) =>
        variant.key === write.key
          ? { ...variant, key: newId, variantId: newId }
          : variant,
      ),
    };
    const created = (snapshotFromDraft(draft)?.variants ?? []).find(
      (variant) => variant.key === newId,
    );
    baseline = {
      ...baseline,
      variants: [
        ...baseline.variants.filter((variant) => variant.key !== write.key),
        created ?? {
          key: newId,
          variantId: newId,
          name: write.input.name,
          priceMinor: write.input.basePriceMinor ?? null,
        },
      ],
    };
  } else {
    const write = args.write;
    baseline = {
      ...baseline,
      variants: baseline.variants.map((variant) =>
        variant.key === write.key
          ? {
              ...variant,
              name: write.input.name,
              priceMinor: write.input.basePriceMinor ?? null,
            }
          : variant,
      ),
    };
  }

  const productId = writeProductId(args.write);
  const snapshot = snapshotFromDraft(draft);
  const remaining =
    productId === null || snapshot === null
      ? []
      : remainingFormWrites(productId, snapshot, baseline);
  return { draft, baseline, done: remaining.length === 0 };
}

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

export type ProductFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyProductFormLoad(args: {
  readonly mode: ProductFormMode;
  readonly canWrite: boolean;
  readonly productId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): ProductFormLoadState {
  if (!args.canWrite) {
    return { kind: "permission" };
  }
  if (args.mode === "create") {
    if (!args.clientReady) {
      return { kind: "error" };
    }
    return { kind: "ready" };
  }
  return classifyProductDetail({
    productId: args.productId,
    clientReady: args.clientReady,
    status: args.status,
    failureKind: args.failureKind,
  });
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
