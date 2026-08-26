/**
 * Catalog write binders for the product form (SHO-139). One
 * `useContractMutation` attempt per write; create is a single
 * `catalog.createProduct`, edit fans out to update/create variant
 * actions with a new key each.
 */
import type { MutationCallOptions } from "@showzy/contract";

import type {
  CreateProductPayload,
  CreateVariantPayload,
  ProductFormMutationResult,
  ProductFormWrite,
  UpdateProductPayload,
  UpdateVariantPayload,
} from "../form/product-form-model";

export type ProductFormTransport = {
  readonly client: {
    readonly catalog: {
      readonly createProduct: (
        input: CreateProductPayload,
        options: MutationCallOptions,
      ) => Promise<{ readonly productId: string }>;
      readonly updateProduct: (
        input: UpdateProductPayload,
        options: MutationCallOptions,
      ) => Promise<{ readonly productId: string }>;
      readonly createVariant: (
        input: CreateVariantPayload,
        options: MutationCallOptions,
      ) => Promise<{ readonly variantId: string }>;
      readonly updateVariant: (
        input: UpdateVariantPayload,
        options: MutationCallOptions,
      ) => Promise<{ readonly variantId: string }>;
    };
  };
};

function createProductInput(input: CreateProductPayload): CreateProductPayload {
  if (input.variants === undefined) {
    return {
      name: input.name,
      basePriceMinor: input.basePriceMinor,
      currency: input.currency,
    };
  }
  return {
    name: input.name,
    basePriceMinor: input.basePriceMinor,
    currency: input.currency,
    variants: input.variants.map((variant) => {
      if (
        variant.basePriceMinor === undefined ||
        variant.currency === undefined
      ) {
        return { name: variant.name };
      }
      return {
        name: variant.name,
        basePriceMinor: variant.basePriceMinor,
        currency: variant.currency,
      };
    }),
  };
}

export function bindProductFormMutate(client: ProductFormTransport) {
  return (
    input: ProductFormWrite,
    options: MutationCallOptions,
  ): Promise<ProductFormMutationResult> => {
    switch (input.kind) {
      case "createProduct":
        return client.client.catalog
          .createProduct(createProductInput(input.input), options)
          .then((output) => ({
            kind: "product" as const,
            productId: output.productId,
          }));
      case "updateProduct":
        return client.client.catalog
          .updateProduct(input.input, options)
          .then((output) => ({
            kind: "product" as const,
            productId: output.productId,
          }));
      case "createVariant":
        return client.client.catalog
          .createVariant(input.input, options)
          .then((output) => ({
            kind: "variant" as const,
            variantId: output.variantId,
          }));
      case "updateVariant":
        return client.client.catalog
          .updateVariant(input.input, options)
          .then((output) => ({
            kind: "variant" as const,
            variantId: output.variantId,
          }));
    }
  };
}
