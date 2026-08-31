import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import {
  personalPrices,
  priceListEntries,
  priceLists,
} from "@showzy/db/schema/pricing";
import { moneyToCanonical } from "@showzy/module-kit/canonical";
import { uniqueIds } from "@showzy/module-kit/unique-ids";
import { and, eq, inArray, or } from "drizzle-orm";
import type { z } from "zod";

import {
  PRICING_RESOLVER_VERSION,
  matchLevelSchema,
  priceSourceSchema,
  resolvedPriceSchema,
} from "../actions/resolve-product-prices.contract.js";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type PriceSource = z.infer<typeof priceSourceSchema>;
type MatchLevel = z.infer<typeof matchLevelSchema>;
type ResolvedPrice = z.infer<typeof resolvedPriceSchema>;

export interface ResolveItem {
  readonly productId: string;
  readonly variantId?: string | undefined;
}

export interface CatalogVariantFact {
  readonly variantId: string;
  readonly basePriceMinor: string | null;
  readonly currency: string | null;
}

export interface CatalogProductFact {
  readonly productId: string;
  readonly basePriceMinor: string;
  readonly currency: string;
  readonly variants: readonly CatalogVariantFact[];
}

export interface CustomerPricingAssignment {
  readonly customerId: string;
  readonly priceListId: string | null;
  readonly groupPriceListId: string | null;
}

interface LevelHit {
  readonly unitPriceMinor: string;
  readonly currency: string;
  readonly matchLevel: MatchLevel;
  readonly personalPriceId?: string;
  readonly priceListId?: string;
  readonly entryId?: string;
}

interface LevelIndex {
  readonly productHits: ReadonlyMap<string, LevelHit>;
  readonly variantHits: ReadonlyMap<string, LevelHit>;
}

interface PriceRow {
  readonly id: string;
  readonly productId: string;
  readonly variantId: string | null;
  readonly priceMinor: bigint;
  readonly currency: string;
  readonly personalPriceId?: string;
  readonly priceListId?: string;
}

function variantKey(productId: string, variantId: string): string {
  return `${productId}\0${variantId}`;
}

function pickHit(index: LevelIndex, item: ResolveItem): LevelHit | undefined {
  if (item.variantId !== undefined) {
    const variantHit = index.variantHits.get(
      variantKey(item.productId, item.variantId),
    );
    if (variantHit !== undefined) {
      return variantHit;
    }
  }
  return index.productHits.get(item.productId);
}

function sourceIdsFromHit(hit: LevelHit): ResolvedPrice["sourceIds"] {
  return {
    ...(hit.personalPriceId === undefined
      ? {}
      : { personalPriceId: hit.personalPriceId }),
    ...(hit.priceListId === undefined ? {} : { priceListId: hit.priceListId }),
    ...(hit.entryId === undefined ? {} : { entryId: hit.entryId }),
  };
}

function toResolvedPrice(
  item: ResolveItem,
  hit: LevelHit,
  source: PriceSource,
): ResolvedPrice {
  return {
    productId: item.productId,
    variantId: item.variantId ?? null,
    unitPriceMinor: hit.unitPriceMinor,
    currency: hit.currency,
    source,
    matchLevel: hit.matchLevel,
    sourceIds: sourceIdsFromHit(hit),
    resolverVersion: PRICING_RESOLVER_VERSION,
  };
}

function indexHits(rows: readonly PriceRow[]): LevelIndex {
  const productHits = new Map<string, LevelHit>();
  const variantHits = new Map<string, LevelHit>();
  for (const row of rows) {
    const hit: LevelHit = {
      unitPriceMinor: moneyToCanonical(row.priceMinor),
      currency: row.currency,
      matchLevel: row.variantId === null ? "product" : "variant",
      ...(row.personalPriceId === undefined
        ? {}
        : { personalPriceId: row.personalPriceId }),
      ...(row.priceListId === undefined
        ? {}
        : { priceListId: row.priceListId }),
      ...(row.personalPriceId === undefined ? { entryId: row.id } : {}),
    };
    if (row.variantId === null) {
      productHits.set(row.productId, hit);
    } else {
      variantHits.set(variantKey(row.productId, row.variantId), hit);
    }
  }
  return { productHits, variantHits };
}

async function loadPersonalHits(
  tx: StaffDb,
  companyId: string,
  customerId: string,
  productIds: readonly string[],
): Promise<LevelIndex> {
  const rows = await tx
    .select({
      id: personalPrices.id,
      productId: personalPrices.productId,
      variantId: personalPrices.variantId,
      priceMinor: personalPrices.priceMinor,
      currency: personalPrices.currency,
    })
    .from(personalPrices)
    .where(
      and(
        eq(personalPrices.companyId, companyId),
        eq(personalPrices.customerId, customerId),
        inArray(personalPrices.productId, [...productIds]),
      ),
    );
  return indexHits(rows.map((row) => ({ ...row, personalPriceId: row.id })));
}

async function loadActiveListHits(
  tx: StaffDb,
  companyId: string,
  productIds: readonly string[],
  listIds: readonly string[],
): Promise<{
  readonly byListId: ReadonlyMap<string, LevelIndex>;
  readonly defaultList: LevelIndex;
}> {
  const listMatch =
    listIds.length === 0
      ? eq(priceLists.isDefault, true)
      : or(
          inArray(priceListEntries.priceListId, [...listIds]),
          eq(priceLists.isDefault, true),
        );
  const rows = await tx
    .select({
      id: priceListEntries.id,
      priceListId: priceListEntries.priceListId,
      productId: priceListEntries.productId,
      variantId: priceListEntries.variantId,
      priceMinor: priceListEntries.priceMinor,
      currency: priceListEntries.currency,
      isDefault: priceLists.isDefault,
    })
    .from(priceListEntries)
    .innerJoin(
      priceLists,
      and(
        eq(priceLists.companyId, priceListEntries.companyId),
        eq(priceLists.id, priceListEntries.priceListId),
      ),
    )
    .where(
      and(
        eq(priceListEntries.companyId, companyId),
        eq(priceLists.isActive, true),
        listMatch,
        inArray(priceListEntries.productId, [...productIds]),
      ),
    );

  const rowsByListId = new Map<string, PriceRow[]>();
  const defaultRows: PriceRow[] = [];
  for (const row of rows) {
    const priceRow: PriceRow = {
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      priceMinor: row.priceMinor,
      currency: row.currency,
      priceListId: row.priceListId,
    };
    const existing = rowsByListId.get(row.priceListId);
    if (existing === undefined) {
      rowsByListId.set(row.priceListId, [priceRow]);
    } else {
      existing.push(priceRow);
    }
    if (row.isDefault) {
      defaultRows.push(priceRow);
    }
  }

  const byListId = new Map<string, LevelIndex>();
  for (const listId of listIds) {
    byListId.set(listId, indexHits(rowsByListId.get(listId) ?? []));
  }
  return {
    byListId,
    defaultList: indexHits(defaultRows),
  };
}

function resolveBase(product: CatalogProductFact, item: ResolveItem): LevelHit {
  if (item.variantId !== undefined) {
    const variant = product.variants.find(
      (candidate) => candidate.variantId === item.variantId,
    );
    if (variant === undefined) {
      throw new CoreInvariantError(
        "variant missing from catalog facts after existence check",
      );
    }
    if (variant.basePriceMinor !== null && variant.currency !== null) {
      return {
        unitPriceMinor: variant.basePriceMinor,
        currency: variant.currency,
        matchLevel: "variant",
      };
    }
  }
  return {
    unitPriceMinor: product.basePriceMinor,
    currency: product.currency,
    matchLevel: "product",
  };
}

/**
 * Five-level resolution for one company: personal → customer list → group
 * list → company default list → catalog base. Personal hits stay their
 * own query; customer / group / default list hits share one query and
 * are partitioned in code (no per-item queries). Inactive lists are
 * skipped by the list join. Level priority is absolute over match level.
 */
export async function resolveProductPricesForCompany(args: {
  readonly tx: StaffDb;
  readonly companyId: string;
  readonly items: readonly ResolveItem[];
  readonly products: readonly CatalogProductFact[];
  readonly customer: CustomerPricingAssignment | null;
}): Promise<ResolvedPrice[]> {
  const productIds = uniqueIds(args.items.map((item) => item.productId));
  const productById = new Map(
    args.products.map((product) => [product.productId, product]),
  );

  const personal =
    args.customer === null
      ? undefined
      : await loadPersonalHits(
          args.tx,
          args.companyId,
          args.customer.customerId,
          productIds,
        );
  const customerListId = args.customer?.priceListId ?? null;
  const groupListId = args.customer?.groupPriceListId ?? null;
  const listIds = uniqueIds(
    [customerListId, groupListId].filter((id): id is string => id !== null),
  );
  const listHits = await loadActiveListHits(
    args.tx,
    args.companyId,
    productIds,
    listIds,
  );
  const customerList =
    customerListId === null ? undefined : listHits.byListId.get(customerListId);
  const groupList =
    groupListId === null ? undefined : listHits.byListId.get(groupListId);
  const defaultList = listHits.defaultList;

  return args.items.map((item) => {
    const product = productById.get(item.productId);
    if (product === undefined) {
      throw new CoreInvariantError(
        "product missing from catalog facts after existence check",
      );
    }
    const personalHit =
      personal === undefined ? undefined : pickHit(personal, item);
    if (personalHit !== undefined) {
      return toResolvedPrice(item, personalHit, "personal");
    }
    const customerListHit =
      customerList === undefined ? undefined : pickHit(customerList, item);
    if (customerListHit !== undefined) {
      return toResolvedPrice(item, customerListHit, "customer_price_list");
    }
    const groupListHit =
      groupList === undefined ? undefined : pickHit(groupList, item);
    if (groupListHit !== undefined) {
      return toResolvedPrice(item, groupListHit, "group_price_list");
    }
    const defaultHit = pickHit(defaultList, item);
    if (defaultHit !== undefined) {
      return toResolvedPrice(item, defaultHit, "default_price_list");
    }
    return toResolvedPrice(item, resolveBase(product, item), "base");
  });
}
