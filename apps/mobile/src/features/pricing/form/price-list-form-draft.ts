/**
 * Price-list form draft, snapshot, dirty detection, bulk %, and variant
 * expand (SHO-190). UI Zod lives in `price-list-form.schema.ts`; write
 * planning is `price-list-form-plan.ts`.
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

const BULK_PERCENT_PATTERN = /^(100|[1-9]\d?)$/;

export function parseBulkPercent(
  text: string,
): { readonly ok: true; readonly percent: number } | { readonly ok: false } {
  const trimmed = text.trim().replace(",", ".");
  if (!BULK_PERCENT_PATTERN.test(trimmed)) {
    return { ok: false };
  }
  return { ok: true, percent: Number(trimmed) };
}

/**
 * Integer percent off catalog **product** base. Round half-up in minor
 * units so it matches canvas `Math.round` on major units.
 */
export function applyPercentOffMinor(
  baseMinor: bigint,
  percent: number,
): bigint {
  const numerator = baseMinor * (100n - BigInt(percent));
  return (numerator + 50n) / 100n;
}

/**
 * UI-only bulk %: writes product-level price texts only. Variant rows
 * are left untouched (not a promo engine).
 */
export function applyBulkPercentOff(args: {
  readonly draft: PriceListFormDraft;
  readonly percent: number;
  readonly basePriceMinorByProductId: ReadonlyMap<string, string>;
}): PriceListFormDraft {
  return {
    ...args.draft,
    entries: args.draft.entries.map((entry) => {
      if (entry.variantId !== null) {
        return entry;
      }
      const base = args.basePriceMinorByProductId.get(entry.productId);
      if (base === undefined) {
        return entry;
      }
      const next = applyPercentOffMinor(BigInt(base), args.percent);
      return {
        ...entry,
        priceText: formatMajorUnitsFromMinor(moneyToWire(next)),
      };
    }),
  };
}

export function isPriceListFormDirty(
  draft: PriceListFormDraft,
  origin: PriceListFormDraft,
): boolean {
  if (
    draft.name !== origin.name ||
    draft.isDefault !== origin.isDefault ||
    draft.isActive !== origin.isActive
  ) {
    return true;
  }
  const originByKey = new Map(
    origin.entries.map((entry) => [entry.key, entry.priceText]),
  );
  const draftKeys = new Set(draft.entries.map((entry) => entry.key));
  for (const entry of draft.entries) {
    const previous = originByKey.get(entry.key);
    if (previous === undefined) {
      if (entry.priceText.trim().length > 0) {
        return true;
      }
      continue;
    }
    if (entry.priceText !== previous) {
      return true;
    }
  }
  for (const entry of origin.entries) {
    if (!draftKeys.has(entry.key) && entry.priceText.trim().length > 0) {
      return true;
    }
  }
  return false;
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

/**
 * Display-only percent vs catalog base. Null when there is no entered
 * price or the catalog base is zero.
 */
export function priceDiffPercent(
  listMinor: bigint,
  baseMinor: bigint,
): number | null {
  if (baseMinor <= 0n) {
    return null;
  }
  const numerator = (listMinor - baseMinor) * 1000n;
  const half = baseMinor / 2n;
  const scaled =
    numerator >= 0n
      ? (numerator + half) / baseMinor
      : (numerator - half) / baseMinor;
  const rounded = scaled >= 0n ? (scaled + 5n) / 10n : (scaled - 5n) / 10n;
  return Number(rounded);
}

export function formatPriceDiffPercent(diff: number | null): string {
  if (diff === null) {
    return "—";
  }
  if (diff > 0) {
    return `+${String(diff)}%`;
  }
  return `${String(diff)}%`;
}

export type PriceDiffTone = "empty" | "down" | "up" | "same";

export function priceDiffTone(diff: number | null): PriceDiffTone {
  if (diff === null) {
    return "empty";
  }
  if (diff < 0) {
    return "down";
  }
  if (diff > 0) {
    return "up";
  }
  return "same";
}

export function listPriceDiff(args: {
  readonly priceText: string;
  readonly basePriceMinor: string;
}): { readonly label: string; readonly tone: PriceDiffTone } {
  if (args.priceText.trim().length === 0) {
    return { label: "—", tone: "empty" };
  }
  const parsed = parseMajorUnitsToMinor(args.priceText);
  if (!parsed.ok) {
    return { label: "—", tone: "empty" };
  }
  const diff = priceDiffPercent(parsed.minor, BigInt(args.basePriceMinor));
  return {
    label: formatPriceDiffPercent(diff),
    tone: priceDiffTone(diff),
  };
}

export function originPriceTextByKey(
  origin: PriceListFormDraft,
): ReadonlyMap<string, string> {
  return new Map(origin.entries.map((entry) => [entry.key, entry.priceText]));
}
