import { z } from "zod";

import {
  currencyCodeSchema,
  nonNegativeMoneyWireSchema,
} from "../wire.contract.js";

/**
 * Created/updated variant. T4's product view embeds the same override
 * fields without `productId`; this write returns the parent id so the
 * client does not need a second round-trip.
 */
export const variantViewSchema = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  name: z.string(),
  basePriceMinor: nonNegativeMoneyWireSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
});
