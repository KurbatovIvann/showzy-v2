import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

/** Batch ceiling shared with `pricing.resolveProductPrices` (feature card). */
export const PRODUCT_PRICING_FACTS_MAX_ITEMS = 200;

/**
 * Canonical signed integer minor units (money.md / contract.md §3): `0` or a
 * non-zero value without a leading plus, leading zeros, decimal, or exponent.
 */
const moneyWireSchema = z
  .string()
  .regex(
    /^(0|-?[1-9][0-9]*)$/,
    "Expected a canonical signed int64 decimal string",
  );

const productPricingFactsItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
});

export const getProductPricingFactsInputSchema = z.object({
  items: z
    .array(productPricingFactsItemSchema)
    .min(1)
    .max(PRODUCT_PRICING_FACTS_MAX_ITEMS),
});

export const getProductPricingFactsOutputSchema = z.object({
  products: z.array(
    z.object({
      productId: z.uuid(),
      basePriceMinor: moneyWireSchema,
      currency: z.string().length(3),
      variants: z.array(
        z.object({
          variantId: z.uuid(),
          basePriceMinor: moneyWireSchema.nullable(),
          currency: z.string().length(3).nullable(),
        }),
      ),
    }),
  ),
});

export const getProductPricingFactsContract = defineActionContract({
  name: "catalog.getProductPricingFacts",
  description:
    "Return catalog base-price facts for a batch of products in the staff member's active company. Each product includes its base price and every variant (variant id plus a nullable base-price override). The whole batch fails with not-found when any product or named variant is missing, belongs to another product, or is outside the company.",
  principal: "staff",
  transport: "internal",
  input: getProductPricingFactsInputSchema,
  output: getProductPricingFactsOutputSchema,
  permissions: ["products:view"],
  aiExposure: "internal",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 5_000,
});
