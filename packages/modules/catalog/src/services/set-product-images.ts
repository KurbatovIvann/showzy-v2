import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { productMedia, products } from "@showzy/db/schema/catalog";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { setProductImagesOutputSchema } from "../actions/set-product-images.contract.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type SetOutput = z.output<typeof setProductImagesOutputSchema>;

export async function replaceProductImages(env: {
  readonly ctx: StaffCtx;
  readonly productId: string;
  readonly fileIds: readonly string[];
}): Promise<SetOutput> {
  const { ctx, productId, fileIds } = env;
  const db = requireWritable(ctx.db);

  const existing = (
    await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.companyId, ctx.companyId), eq(products.id, productId)),
      )
      .limit(1)
      .for("update")
  )[0];
  if (existing === undefined) {
    throw new NotFoundError();
  }

  await db
    .delete(productMedia)
    .where(
      and(
        eq(productMedia.companyId, ctx.companyId),
        eq(productMedia.productId, productId),
      ),
    );

  if (fileIds.length > 0) {
    const inserted = await db
      .insert(productMedia)
      .values(
        fileIds.map((fileId, position) => ({
          companyId: ctx.companyId,
          productId,
          fileId,
          position,
        })),
      )
      .returning({
        fileId: productMedia.fileId,
        position: productMedia.position,
      });
    if (inserted.length !== fileIds.length) {
      throw new CoreInvariantError(
        "catalog.setProductImages insert returned a different row count",
      );
    }
  }

  ctx.log.info(
    {
      product_id: productId,
      image_count: fileIds.length,
    },
    "catalog.setProductImages replaced product images",
  );

  return { productId, fileIds: [...fileIds] };
}
