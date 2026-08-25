import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { productMedia, products } from "@showzy/db/schema/catalog";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  setProductImagesInputSchema,
  setProductImagesOutputSchema,
} from "../actions/set-product-images.contract.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type SetInput = z.output<typeof setProductImagesInputSchema>;
type SetOutput = z.output<typeof setProductImagesOutputSchema>;

export async function replaceProductImages(env: {
  readonly ctx: StaffCtx;
  readonly input: SetInput;
}): Promise<SetOutput> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  const existing = (
    await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.companyId, ctx.companyId),
          eq(products.id, input.productId),
        ),
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
        eq(productMedia.productId, input.productId),
      ),
    );

  if (input.fileIds.length > 0) {
    const inserted = await db
      .insert(productMedia)
      .values(
        input.fileIds.map((fileId, position) => ({
          companyId: ctx.companyId,
          productId: input.productId,
          fileId,
          position,
        })),
      )
      .returning({
        fileId: productMedia.fileId,
        position: productMedia.position,
      });
    if (inserted.length !== input.fileIds.length) {
      throw new CoreInvariantError(
        "catalog.setProductImages insert returned a different row count",
      );
    }
  }

  ctx.log.info(
    {
      product_id: input.productId,
      image_count: input.fileIds.length,
    },
    "catalog.setProductImages replaced product images",
  );

  return { productId: input.productId, fileIds: input.fileIds };
}
