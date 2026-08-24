import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { products, productVariants } from "@showzy/db/schema/catalog";
import { and, eq } from "drizzle-orm";

import type { WritableStaffDb } from "./writable.js";

export type CatalogLifecycleStatus = "active" | "archived";

function asCatalogStatus(value: string): CatalogLifecycleStatus {
  if (value === "active" || value === "archived") {
    return value;
  }
  throw new CoreInvariantError(
    "catalog row has a status outside active/archived",
  );
}

export async function setProductStatus(
  db: WritableStaffDb,
  args: {
    companyId: string;
    productId: string;
    status: CatalogLifecycleStatus;
  },
): Promise<{ productId: string; status: CatalogLifecycleStatus }> {
  const rows = await db
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(
      and(
        eq(products.companyId, args.companyId),
        eq(products.id, args.productId),
      ),
    )
    .limit(1)
    .for("update");
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
  const current = asCatalogStatus(row.status);
  if (current === args.status) {
    return { productId: row.id, status: current };
  }

  const updated = await db
    .update(products)
    .set({ status: args.status })
    .where(
      and(
        eq(products.companyId, args.companyId),
        eq(products.id, args.productId),
      ),
    )
    .returning({ id: products.id, status: products.status });
  const saved = updated[0];
  if (saved === undefined) {
    throw new CoreInvariantError(
      "catalog product status update returned no row",
    );
  }
  return { productId: saved.id, status: asCatalogStatus(saved.status) };
}

export async function setVariantStatus(
  db: WritableStaffDb,
  args: {
    companyId: string;
    variantId: string;
    status: CatalogLifecycleStatus;
  },
): Promise<{ variantId: string; status: CatalogLifecycleStatus }> {
  const rows = await db
    .select({ id: productVariants.id, status: productVariants.status })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, args.companyId),
        eq(productVariants.id, args.variantId),
      ),
    )
    .limit(1)
    .for("update");
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
  const current = asCatalogStatus(row.status);
  if (current === args.status) {
    return { variantId: row.id, status: current };
  }

  const updated = await db
    .update(productVariants)
    .set({ status: args.status })
    .where(
      and(
        eq(productVariants.companyId, args.companyId),
        eq(productVariants.id, args.variantId),
      ),
    )
    .returning({ id: productVariants.id, status: productVariants.status });
  const saved = updated[0];
  if (saved === undefined) {
    throw new CoreInvariantError(
      "catalog variant status update returned no row",
    );
  }
  return { variantId: saved.id, status: asCatalogStatus(saved.status) };
}
