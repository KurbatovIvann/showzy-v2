/**
 * Price-list form draft, snapshot, dirty detection, and variant expand
 * (SHO-190). Display % lives in `price-list-form-diff.ts`; bulk % in
 * `price-list-form-bulk.ts`. UI Zod is `price-list-form.schema.ts`;
 * write planning is `price-list-form-plan.ts`.
 */
import { moneyToWire } from "@showzy/contract";

import {
  formatMajorUnitsFromMinor,
  parseMajorUnitsToMinor,
} from "../../../format/money-input";
import {
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  priceListFormDraftSchema,
  type PriceListFormFieldErrors,
} from "./price-list-form.schema";

export {
  emptyFieldErrors,
  type NameErrorKey,
  type PriceErrorKey,
  type PriceListFormFieldErrors,
} from "./price-list-form.schema";

export type PriceListFormMode = "create" | "edit";

export type PriceListEntryDraft = {
  key: string;
  productId: string;
  variantId: string | null;
  priceText: string;
};

export type PriceListFormDraft = {
  name: string;
  isDefault: boolean;
  isActive: boolean;
  entries: PriceListEntryDraft[];
};

export type PriceListEntrySnapshot = {
  readonly key: string;
  readonly productId: string;
  readonly variantId: string | null;
  readonly priceMinor: string | null;
};

export type PriceListFormSnapshot = {
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly entries: readonly PriceListEntrySnapshot[];
};

/**
 * Keyed origin for dirty + "changed" chrome. Not RHF defaults and not
 * the live draft — commit on hydrate / save / variant merge only.
 */
export type PriceListFormOrigin = {
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly prices: ReadonlyMap<string, string>;
};

export type PriceListStoredEntry = {
  readonly productId: string;
  readonly variantId: string | null;
  readonly priceMinor: string;
};

export type PriceListCatalogProduct = {
  readonly id: string;
  readonly name: string;
  readonly basePriceMinor: string;
  readonly variantCount: number;
  readonly archived: boolean;
};

export type PriceListCatalogVariant = {
  readonly id: string;
  readonly name: string;
  readonly basePriceMinor: string | null;
  readonly archived: boolean;
};

export type PriceListVariantMeta = {
  readonly name: string;
  readonly archived: boolean;
  readonly basePriceMinor: string | null;
};

export function priceListEntryKey(
  productId: string,
  variantId: string | null,
): string {
  return variantId === null ? productId : `${productId}:${variantId}`;
}

export function emptyPriceListFormDraft(): PriceListFormDraft {
  return {
    name: "",
    isDefault: false,
    isActive: true,
    entries: [],
  };
}

export function clonePriceListFormDraft(
  values: PriceListFormDraft,
): PriceListFormDraft {
  return {
    name: values.name,
    isDefault: values.isDefault,
    isActive: values.isActive,
    entries: values.entries.map((entry) => ({
      key: entry.key,
      productId: entry.productId,
      variantId: entry.variantId,
      priceText: entry.priceText,
    })),
  };
}

export function storedEntryMap(
  entries: readonly PriceListStoredEntry[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(
      priceListEntryKey(entry.productId, entry.variantId),
      entry.priceMinor,
    );
  }
  return map;
}

function priceTextFromStored(
  stored: ReadonlyMap<string, string>,
  productId: string,
  variantId: string | null,
): string {
  const wire = stored.get(priceListEntryKey(productId, variantId));
  return wire === undefined ? "" : formatMajorUnitsFromMinor(wire);
}

function storedVariantIdsForProduct(
  stored: ReadonlyMap<string, string>,
  productId: string,
): readonly string[] {
  const prefix = `${productId}:`;
  const variantIds: string[] = [];
  for (const key of stored.keys()) {
    if (key.startsWith(prefix)) {
      variantIds.push(key.slice(prefix.length));
    }
  }
  return variantIds;
}

export function draftFromPriceList(args: {
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly products: readonly PriceListCatalogProduct[];
  readonly stored: ReadonlyMap<string, string>;
}): PriceListFormDraft {
  const entries: PriceListEntryDraft[] = [];
  for (const product of args.products) {
    entries.push({
      key: priceListEntryKey(product.id, null),
      productId: product.id,
      variantId: null,
      priceText: priceTextFromStored(args.stored, product.id, null),
    });
    for (const variantId of storedVariantIdsForProduct(
      args.stored,
      product.id,
    )) {
      entries.push({
        key: priceListEntryKey(product.id, variantId),
        productId: product.id,
        variantId,
        priceText: priceTextFromStored(args.stored, product.id, variantId),
      });
    }
  }
  return {
    name: args.name,
    isDefault: args.isDefault,
    isActive: args.isDefault ? true : args.isActive,
    entries,
  };
}

export function snapshotFromPriceList(args: {
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly products: readonly PriceListCatalogProduct[];
  readonly stored: ReadonlyMap<string, string>;
}): PriceListFormSnapshot {
  const draft = draftFromPriceList(args);
  return {
    name: draft.name.trim(),
    isDefault: draft.isDefault,
    isActive: draft.isActive,
    entries: draft.entries.map((entry) => snapshotEntry(entry)),
  };
}

function snapshotEntry(entry: PriceListEntryDraft): PriceListEntrySnapshot {
  const parsed = parseMajorUnitsToMinor(entry.priceText);
  return {
    key: entry.key,
    productId: entry.productId,
    variantId: entry.variantId,
    priceMinor: parsed.ok ? moneyToWire(parsed.minor) : null,
  };
}

export function mergeExpandedVariants(args: {
  readonly draft: PriceListFormDraft;
  readonly origin: PriceListFormDraft;
  readonly baseline: PriceListFormSnapshot | null;
  readonly productId: string;
  readonly variants: readonly PriceListCatalogVariant[];
  readonly stored: ReadonlyMap<string, string>;
}): {
  readonly draft: PriceListFormDraft;
  readonly origin: PriceListFormDraft;
  readonly baseline: PriceListFormSnapshot | null;
} {
  const existing = new Set(args.draft.entries.map((entry) => entry.key));
  const addedDraft: PriceListEntryDraft[] = [];
  const addedOrigin: PriceListEntryDraft[] = [];
  const addedBaseline: PriceListEntrySnapshot[] = [];
  for (const variant of args.variants) {
    const key = priceListEntryKey(args.productId, variant.id);
    if (existing.has(key)) {
      continue;
    }
    const priceText = priceTextFromStored(
      args.stored,
      args.productId,
      variant.id,
    );
    const row: PriceListEntryDraft = {
      key,
      productId: args.productId,
      variantId: variant.id,
      priceText,
    };
    addedDraft.push(row);
    addedOrigin.push({ ...row });
    addedBaseline.push(snapshotEntry(row));
  }
  if (addedDraft.length === 0) {
    return {
      draft: args.draft,
      origin: args.origin,
      baseline: args.baseline,
    };
  }
  const insertAfter = args.draft.entries.findIndex(
    (entry) => entry.productId === args.productId && entry.variantId === null,
  );
  const draftEntries = [...args.draft.entries];
  const originEntries = [...args.origin.entries];
  if (insertAfter >= 0) {
    draftEntries.splice(insertAfter + 1, 0, ...addedDraft);
    const originIndex = originEntries.findIndex(
      (entry) => entry.productId === args.productId && entry.variantId === null,
    );
    originEntries.splice(
      originIndex >= 0 ? originIndex + 1 : originEntries.length,
      0,
      ...addedOrigin,
    );
  } else {
    draftEntries.push(...addedDraft);
    originEntries.push(...addedOrigin);
  }
  return {
    draft: { ...args.draft, entries: draftEntries },
    origin: { ...args.origin, entries: originEntries },
    baseline:
      args.baseline === null
        ? null
        : {
            ...args.baseline,
            entries: [...args.baseline.entries, ...addedBaseline],
          },
  };
}

export function originFromDraft(
  draft: PriceListFormDraft,
): PriceListFormOrigin {
  return {
    name: draft.name,
    isDefault: draft.isDefault,
    isActive: draft.isActive,
    prices: new Map(draft.entries.map((entry) => [entry.key, entry.priceText])),
  };
}

export function originPriceTextByKey(
  origin: PriceListFormDraft | PriceListFormOrigin,
): ReadonlyMap<string, string> {
  return pricesOfOrigin(origin);
}

function isKeyedOrigin(
  origin: PriceListFormDraft | PriceListFormOrigin,
): origin is PriceListFormOrigin {
  return !("entries" in origin);
}

function pricesOfOrigin(
  origin: PriceListFormDraft | PriceListFormOrigin,
): ReadonlyMap<string, string> {
  if (isKeyedOrigin(origin)) {
    return origin.prices;
  }
  return new Map(origin.entries.map((entry) => [entry.key, entry.priceText]));
}

/**
 * Empty text vs a missing origin row is not dirty; a stored `0` is.
 * Does not clone or mutate either side.
 */
export function isPriceListEntryDirty(
  priceText: string,
  originPriceText: string | undefined,
): boolean {
  if (originPriceText === undefined) {
    return priceText.trim().length > 0;
  }
  return priceText !== originPriceText;
}

function isPriceListHeaderDirty(
  draft: PriceListFormDraft,
  origin: PriceListFormDraft | PriceListFormOrigin,
): boolean {
  return (
    draft.name !== origin.name ||
    draft.isDefault !== origin.isDefault ||
    draft.isActive !== origin.isActive
  );
}

function scanDirtyEntryKeys(
  draft: PriceListFormDraft,
  originPrices: ReadonlyMap<string, string>,
): Set<string> {
  const dirtyKeys = new Set<string>();
  const draftKeys = new Set<string>();
  for (const entry of draft.entries) {
    draftKeys.add(entry.key);
    if (isPriceListEntryDirty(entry.priceText, originPrices.get(entry.key))) {
      dirtyKeys.add(entry.key);
    }
  }
  for (const [key, priceText] of originPrices) {
    if (!draftKeys.has(key) && priceText.trim().length > 0) {
      dirtyKeys.add(key);
    }
  }
  return dirtyKeys;
}

export function isPriceListFormDirty(
  draft: PriceListFormDraft,
  origin: PriceListFormDraft | PriceListFormOrigin,
): boolean {
  if (isPriceListHeaderDirty(draft, origin)) {
    return true;
  }
  return scanDirtyEntryKeys(draft, pricesOfOrigin(origin)).size > 0;
}

const ENTRY_PRICE_PATH = /^entries\.(\d+)\.priceText$/;

/**
 * Per-changed-path dirty against a keyed origin map. Full scan when the
 * path is missing (reset / field-array). Does not clone the draft.
 */
export function reconcilePriceListFormDirty(args: {
  readonly values: PriceListFormDraft;
  readonly origin: PriceListFormOrigin;
  readonly changedPath: string | undefined;
  readonly dirtyKeys: ReadonlySet<string>;
}): { readonly dirty: boolean; readonly dirtyKeys: ReadonlySet<string> } {
  const headerDirty = isPriceListHeaderDirty(args.values, args.origin);
  const entryMatch =
    args.changedPath === undefined
      ? null
      : ENTRY_PRICE_PATH.exec(args.changedPath);
  if (
    args.changedPath === "name" ||
    args.changedPath === "isDefault" ||
    args.changedPath === "isActive"
  ) {
    return {
      dirty: headerDirty || args.dirtyKeys.size > 0,
      dirtyKeys: args.dirtyKeys,
    };
  }
  if (entryMatch !== null) {
    const index = Number(entryMatch[1]);
    const entry = args.values.entries[index];
    if (entry === undefined) {
      const dirtyKeys = scanDirtyEntryKeys(args.values, args.origin.prices);
      return { dirty: headerDirty || dirtyKeys.size > 0, dirtyKeys };
    }
    const dirtyKeys = new Set(args.dirtyKeys);
    if (
      isPriceListEntryDirty(entry.priceText, args.origin.prices.get(entry.key))
    ) {
      dirtyKeys.add(entry.key);
    } else {
      dirtyKeys.delete(entry.key);
    }
    return { dirty: headerDirty || dirtyKeys.size > 0, dirtyKeys };
  }
  const dirtyKeys = scanDirtyEntryKeys(args.values, args.origin.prices);
  return { dirty: headerDirty || dirtyKeys.size > 0, dirtyKeys };
}

export function shouldPreventPriceListLeave(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly leaveArmed: boolean;
}): boolean {
  return args.dirty && !args.pending && !args.leaveArmed;
}

export function priceListFormFieldChanged(
  mode: PriceListFormMode,
  current: string | boolean,
  origin: string | boolean,
): boolean {
  return mode === "edit" && current !== origin;
}

export function blocksDeactivateWhenDefault(args: {
  readonly isDefault: boolean;
  readonly nextActive: boolean;
}): boolean {
  return args.isDefault && !args.nextActive;
}

function draftSchemaInput(draft: PriceListFormDraft) {
  return {
    name: draft.name,
    isDefault: draft.isDefault,
    isActive: draft.isActive,
    entries: draft.entries.map((entry) => ({
      key: entry.key,
      productId: entry.productId,
      variantId: entry.variantId,
      priceText: entry.priceText,
    })),
  };
}

export function validatePriceListForm(
  draft: PriceListFormDraft,
): PriceListFormFieldErrors {
  const parsed = priceListFormDraftSchema.safeParse(draftSchemaInput(draft));
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error, draft.entries);
}

export function isPriceListFormValid(
  errors: PriceListFormFieldErrors,
): boolean {
  return errors.name === null && Object.keys(errors.entries).length === 0;
}

export type PriceListFormUiParse =
  | { readonly ok: true; readonly draft: PriceListFormDraft }
  | { readonly ok: false; readonly errors: PriceListFormFieldErrors };

export function parsePriceListFormUiDraft(
  draft: PriceListFormDraft,
): PriceListFormUiParse {
  const errors = validatePriceListForm(draft);
  if (!isPriceListFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}

export function snapshotFromDraft(
  draft: PriceListFormDraft,
): PriceListFormSnapshot | null {
  const errors = validatePriceListForm(draft);
  if (!isPriceListFormValid(errors)) {
    return null;
  }
  return {
    name: draft.name.trim(),
    isDefault: draft.isDefault,
    isActive: draft.isDefault ? true : draft.isActive,
    entries: draft.entries.map((entry) => snapshotEntry(entry)),
  };
}

export function filterCatalogProducts<T extends { readonly name: string }>(
  products: readonly T[],
  query: string,
): readonly T[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return products;
  }
  return products.filter((product) =>
    product.name.toLowerCase().includes(normalized),
  );
}
