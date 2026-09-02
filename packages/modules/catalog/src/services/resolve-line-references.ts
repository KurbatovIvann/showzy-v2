import type { ActionCtx } from "@showzy/core";
import { ConflictError, NotFoundError } from "@showzy/core/errors";
import { products, productVariants } from "@showzy/db/schema/catalog";
import { uniqueIds } from "@showzy/module-kit/unique-ids";
import {
  candidatesContainingQuery,
  formatReferenceConflictMessage,
  normalizeReferenceQuery,
  pickUniqueNormalizedMatch,
  REFERENCE_CONFLICT_LABELS_MAX,
  type EntityRef,
} from "@showzy/validation/entity-ref";
import {
  likeContainsPattern,
  sanitizeLikeLiteral,
} from "@showzy/validation/pagination";
import { and, asc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

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

function orIlike(
  column: typeof products.name,
  queries: readonly string[],
  patternOf: (normalized: string) => string | undefined,
): SQL | undefined {
  const parts: SQL[] = [];
  for (const query of queries) {
    const pattern = patternOf(normalizeReferenceQuery(query));
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

function mergeProductCandidates(
  primary: readonly ProductCandidate[],
  extra: readonly ProductCandidate[],
): ProductCandidate[] {
  const byId = new Map<string, ProductCandidate>();
  for (const row of primary) {
    byId.set(row.id, row);
  }
  for (const row of extra) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

function productLabel(row: ProductCandidate): string {
  return `${row.name} (${row.currency}, ${row.id})`;
}

function variantLabel(row: VariantCandidate): string {
  return `${row.name} (${row.id})`;
}

function conflictLabels<T>(
  query: string,
  rows: readonly T[],
  labelOf: (row: T) => string,
): ConflictError {
  const labels = [...rows]
    .map(labelOf)
    .toSorted((left, right) => left.localeCompare(right))
    .slice(0, REFERENCE_CONFLICT_LABELS_MAX);
  return new ConflictError(formatReferenceConflictMessage(query, labels));
}

const productCandidateColumns = {
  id: products.id,
  name: products.name,
  status: products.status,
  currency: products.currency,
} as const;

async function loadProductsById(
  db: StaffDb,
  companyId: string,
  ids: readonly string[],
): Promise<ProductCandidate[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select(productCandidateColumns)
    .from(products)
    .where(and(eq(products.companyId, companyId), inArray(products.id, ids)));
}

/**
 * Equality ILIKE (no `%` wrap) for every unique query string. No scan cap:
 * different query strings cannot crowd each other out, and duplicate exact
 * names are the natural CONFLICT set rather than a contains bag.
 */
async function loadActiveProductsByExactQuery(
  db: StaffDb,
  companyId: string,
  queries: readonly string[],
): Promise<ProductCandidate[]> {
  const exact = orIlike(products.name, queries, sanitizeLikeLiteral);
  if (exact === undefined) {
    return [];
  }
  return db
    .select(productCandidateColumns)
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.status, "active"),
        exact,
      ),
    );
}

async function loadActiveProductsByContainsQuery(
  db: StaffDb,
  companyId: string,
  queries: readonly string[],
): Promise<ProductCandidate[]> {
  const selects = queries.flatMap((query) => {
    const pattern = likeContainsPattern(normalizeReferenceQuery(query));
    if (pattern === undefined) {
      return [];
    }
    return [
      db
        .select(productCandidateColumns)
        .from(products)
        .where(
          and(
            eq(products.companyId, companyId),
            eq(products.status, "active"),
            ilike(products.name, pattern),
          ),
        )
        .orderBy(asc(products.name), asc(products.id))
        .limit(RESOLVE_LINE_CANDIDATE_MAX),
    ];
  });
  const first = selects[0];
  if (first === undefined) {
    return [];
  }
  const second = selects[1];
  if (second === undefined) {
    return await first;
  }
  return await unionAll(first, second, ...selects.slice(2));
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
    throw conflictLabels(ref.value, picked.rows, variantLabel);
  }
  return picked.row;
}

/**
 * Bounded reads: at most one product-id SELECT, one active exact-name
 * SELECT (uncapped), one contains statement that caps candidates per
 * input query string (not one shared LIMIT across the OR), and one
 * variant SELECT for the resolved product ids. Never one SELECT per
 * input line and never a nested action call.
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
      line.product.by === "query"
        ? [normalizeReferenceQuery(line.product.value)]
        : [],
    ),
  );

  const [idRows, exactRows, containsRows] = await Promise.all([
    loadProductsById(args.db, args.companyId, productIds),
    loadActiveProductsByExactQuery(args.db, args.companyId, productQueries),
    loadActiveProductsByContainsQuery(args.db, args.companyId, productQueries),
  ]);
  const byId = new Map(idRows.map((row) => [row.id, row]));
  const queryRows = mergeProductCandidates(exactRows, containsRows);

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
