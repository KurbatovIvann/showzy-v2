import type { ActionCtx } from "@showzy/core";
import { ConflictError, NotFoundError } from "@showzy/core/errors";
import { products, productVariants } from "@showzy/db/schema/catalog";
import { uniqueIds } from "@showzy/module-kit/unique-ids";
import {
  candidatesContainingQuery,
  formatReferenceConflictMessage,
  pickUniqueNormalizedMatch,
  REFERENCE_CONFLICT_LABELS_MAX,
  type EntityRef,
} from "@showzy/validation/entity-ref";
import { likeContainsPattern } from "@showzy/validation/pagination";
import { and, eq, ilike, inArray, or, type SQL } from "drizzle-orm";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];

const RESOLVE_LINE_CANDIDATE_MAX = 100;

export type LineReferenceInput = {
  readonly product: EntityRef;
  readonly variant?: EntityRef | undefined;
};

export type ResolvedLineReference = {
  readonly productId: string;
  readonly productName: string;
  readonly variantId: string | null;
  readonly variantName: string | null;
};

type ProductCandidate = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly currency: string;
};

type VariantCandidate = {
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  readonly status: string;
};

function orContains(
  column: typeof products.name,
  queries: readonly string[],
): SQL | undefined {
  const parts: SQL[] = [];
  for (const query of queries) {
    const pattern = likeContainsPattern(query);
    if (pattern !== undefined) {
      parts.push(ilike(column, pattern));
    }
  }
  if (parts.length === 0) {
    return undefined;
  }
  const first = parts[0];
  if (first === undefined) {
    return undefined;
  }
  if (parts.length === 1) {
    return first;
  }
  return or(...parts);
}

function productLabel(row: ProductCandidate): string {
  return `${row.name} (${row.currency})`;
}

function conflictLabels(
  query: string,
  rows: readonly { readonly name: string }[],
  labelOf: (row: { readonly name: string }) => string,
): ConflictError {
  const labels = [...rows]
    .map(labelOf)
    .toSorted((left, right) => left.localeCompare(right))
    .slice(0, REFERENCE_CONFLICT_LABELS_MAX);
  return new ConflictError(formatReferenceConflictMessage(query, labels));
}

async function loadProductsById(
  db: StaffDb,
  companyId: string,
  ids: readonly string[],
): Promise<ProductCandidate[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({
      id: products.id,
      name: products.name,
      status: products.status,
      currency: products.currency,
    })
    .from(products)
    .where(and(eq(products.companyId, companyId), inArray(products.id, ids)));
}

async function loadActiveProductsByQuery(
  db: StaffDb,
  companyId: string,
  queries: readonly string[],
): Promise<ProductCandidate[]> {
  const contains = orContains(products.name, queries);
  if (contains === undefined) {
    return [];
  }
  return db
    .select({
      id: products.id,
      name: products.name,
      status: products.status,
      currency: products.currency,
    })
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.status, "active"),
        contains,
      ),
    )
    .limit(RESOLVE_LINE_CANDIDATE_MAX);
}

async function loadVariantsForProducts(
  db: StaffDb,
  companyId: string,
  productIds: readonly string[],
): Promise<VariantCandidate[]> {
  if (productIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      name: productVariants.name,
      status: productVariants.status,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, companyId),
        inArray(productVariants.productId, productIds),
      ),
    );
}

function resolveProductRef(
  ref: EntityRef,
  byId: ReadonlyMap<string, ProductCandidate>,
  queryCandidates: readonly ProductCandidate[],
): ProductCandidate {
  if (ref.by === "id") {
    const row = byId.get(ref.id);
    if (row === undefined) {
      throw new NotFoundError();
    }
    return row;
  }
  const scoped = candidatesContainingQuery(
    ref.value,
    queryCandidates,
    (row) => [row.name],
  );
  const picked = pickUniqueNormalizedMatch(ref.value, scoped, (row) => [
    row.name,
  ]);
  if (picked.kind === "none") {
    throw new NotFoundError();
  }
  if (picked.kind === "ambiguous") {
    throw conflictLabels(ref.value, picked.rows, productLabel);
  }
  return picked.row;
}

function resolveVariantRef(
  ref: EntityRef,
  productId: string,
  variants: readonly VariantCandidate[],
): VariantCandidate {
  const owned = variants.filter((row) => row.productId === productId);
  if (ref.by === "id") {
    const row = owned.find((variant) => variant.id === ref.id);
    if (row === undefined) {
      throw new NotFoundError();
    }
    return row;
  }
  const active = owned.filter((row) => row.status === "active");
  const scoped = candidatesContainingQuery(ref.value, active, (row) => [
    row.name,
  ]);
  const picked = pickUniqueNormalizedMatch(ref.value, scoped, (row) => [
    row.name,
  ]);
  if (picked.kind === "none") {
    throw new NotFoundError();
  }
  if (picked.kind === "ambiguous") {
    throw conflictLabels(ref.value, picked.rows, (row) => row.name);
  }
  return picked.row;
}

/**
 * Bounded reads: at most one product-id SELECT, one active product-query
 * SELECT, and one variant SELECT for the resolved product ids.
 */
export async function resolveCatalogLineReferences(args: {
  readonly db: StaffDb;
  readonly companyId: string;
  readonly lines: readonly LineReferenceInput[];
}): Promise<readonly ResolvedLineReference[]> {
  const productIds = uniqueIds(
    args.lines.flatMap((line) =>
      line.product.by === "id" ? [line.product.id] : [],
    ),
  );
  const productQueries = uniqueIds(
    args.lines.flatMap((line) =>
      line.product.by === "query" ? [line.product.value] : [],
    ),
  );

  const [idRows, queryRows] = await Promise.all([
    loadProductsById(args.db, args.companyId, productIds),
    loadActiveProductsByQuery(args.db, args.companyId, productQueries),
  ]);
  const byId = new Map(idRows.map((row) => [row.id, row]));

  const resolvedProducts: ProductCandidate[] = [];
  for (const line of args.lines) {
    resolvedProducts.push(resolveProductRef(line.product, byId, queryRows));
  }

  const resolvedProductIds = uniqueIds(resolvedProducts.map((row) => row.id));
  const variants = await loadVariantsForProducts(
    args.db,
    args.companyId,
    resolvedProductIds,
  );

  return args.lines.map((line, index) => {
    const product = resolvedProducts[index];
    if (product === undefined) {
      throw new NotFoundError();
    }
    if (line.variant === undefined) {
      return {
        productId: product.id,
        productName: product.name,
        variantId: null,
        variantName: null,
      };
    }
    const variant = resolveVariantRef(line.variant, product.id, variants);
    return {
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
    };
  });
}
