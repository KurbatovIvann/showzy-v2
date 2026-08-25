import { z } from "zod";

import {
  currencyCodeSchema,
  nonNegativeMoneyWireSchema,
} from "../wire.contract.js";

export const productVariantViewSchema = z.object({
  variantId: z.uuid(),
  name: z.string(),
  basePriceMinor: nonNegativeMoneyWireSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
});

/**
 * Created/updated product plus its variants. T7 (`getProduct`) may extend
 * this shape with status and image file ids.
 */
export const productViewSchema = z.object({
  productId: z.uuid(),
  name: z.string(),
  basePriceMinor: nonNegativeMoneyWireSchema,
  currency: currencyCodeSchema,
  variants: z.array(productVariantViewSchema),
});
