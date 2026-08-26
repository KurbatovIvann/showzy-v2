/**
 * Catalog write binders for the product form (SHO-139 / SHO-159). One
 * `useContractMutation` attempt per write; create is a single
 * `catalog.createProduct`, edit fans out to update/create variant
 * actions with a new key each. UI drafts never go on the wire: payloads
 * are typed from `ContractClient` and parsed with the action schemas.
 */
import { contractModules, type MutationCallOptions } from "@showzy/contract";

import type {
  CreateProductPayload,
  CreateVariantPayload,
  ProductFormMutationResult,
  ProductFormWrite,
  UpdateProductPayload,
  UpdateVariantPayload,
} from "../form/product-form-model";

type CatalogWrites = {
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

export type ProductFormTransport = {
  readonly client: {
    readonly catalog: CatalogWrites;
  };
};

function parseCreateProduct(input: CreateProductPayload): CreateProductPayload {
  return contractModules.catalog.createProduct.input.parse(input);
}

function parseUpdateProduct(input: UpdateProductPayload): UpdateProductPayload {
  return contractModules.catalog.updateProduct.input.parse(input);
}

function parseCreateVariant(input: CreateVariantPayload): CreateVariantPayload {
  return contractModules.catalog.createVariant.input.parse(input);
}

function parseUpdateVariant(input: UpdateVariantPayload): UpdateVariantPayload {
  return contractModules.catalog.updateVariant.input.parse(input);
}

function createProductInput(input: CreateProductPayload): CreateProductPayload {
  const variants = input.variants;
  if (variants === undefined) {
    return parseCreateProduct({
      name: input.name,
      basePriceMinor: input.basePriceMinor,
      currency: input.currency,
    });
  }
  return parseCreateProduct({
    name: input.name,
    basePriceMinor: input.basePriceMinor,
    currency: input.currency,
    variants: variants.map((variant) => {
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
  });
}

export function bindProductFormMutate(client: ProductFormTransport) {
  return (
    input: ProductFormWrite,
    options: MutationCallOptions,
  ): Promise<ProductFormMutationResult> => {
    try {
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
            .updateProduct(parseUpdateProduct(input.input), options)
            .then((output) => ({
              kind: "product" as const,
              productId: output.productId,
            }));
        case "createVariant":
          return client.client.catalog
            .createVariant(parseCreateVariant(input.input), options)
            .then((output) => ({
              kind: "variant" as const,
              variantId: output.variantId,
            }));
        case "updateVariant":
          return client.client.catalog
            .updateVariant(parseUpdateVariant(input.input), options)
            .then((output) => ({
              kind: "variant" as const,
              variantId: output.variantId,
            }));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new TypeError("product form write parse failed"));
    }
  };
}
