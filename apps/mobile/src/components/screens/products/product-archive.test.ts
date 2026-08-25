import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import {
  bindCatalogStatusMutate,
  catalogStatusInvalidationKeys,
  invalidateCatalogAfterStatusWrite,
  type CatalogStatusWrite,
} from "./product-archive";
import { GET_PRODUCT_ACTION } from "./product-detail-query";
import { LIST_PRODUCTS_ACTION } from "./products-list-query";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const VARIANT_ID = "11111111-1111-4111-8111-111111111111";

describe("bindCatalogStatusMutate", () => {
  it("routes each write to the matching catalog action with the attempt options", async () => {
    const calls: Array<{
      readonly method: string;
      readonly input: { productId?: string; variantId?: string };
      readonly key: string;
    }> = [];
    const controller = createContractMutationController<
      CatalogStatusWrite,
      unknown
    >({
      mutate: bindCatalogStatusMutate({
        client: {
          catalog: {
            archiveProduct: (input, options: MutationCallOptions) => {
              calls.push({
                method: "archiveProduct",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve({
                productId: input.productId,
                status: "archived",
              });
            },
            restoreProduct: (input, options: MutationCallOptions) => {
              calls.push({
                method: "restoreProduct",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve({
                productId: input.productId,
                status: "active",
              });
            },
            archiveVariant: (input, options: MutationCallOptions) => {
              calls.push({
                method: "archiveVariant",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve({
                variantId: input.variantId,
                status: "archived",
              });
            },
            restoreVariant: (input, options: MutationCallOptions) => {
              calls.push({
                method: "restoreVariant",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve({
                variantId: input.variantId,
                status: "active",
              });
            },
          },
        },
      }),
    });

    await controller.submit({
      kind: "archiveProduct",
      productId: PRODUCT_ID,
    });
    await controller.submit({
      kind: "restoreProduct",
      productId: PRODUCT_ID,
    });
    await controller.submit({
      kind: "archiveVariant",
      variantId: VARIANT_ID,
    });
    await controller.submit({
      kind: "restoreVariant",
      variantId: VARIANT_ID,
    });

    expect(calls.map((call) => call.method)).toEqual([
      "archiveProduct",
      "restoreProduct",
      "archiveVariant",
      "restoreVariant",
    ]);
    expect(calls[0]?.input).toEqual({ productId: PRODUCT_ID });
    expect(calls[2]?.input).toEqual({ variantId: VARIANT_ID });
    expect(calls.every((call) => call.key.length > 0)).toBe(true);
  });
});

describe("catalogStatusInvalidationKeys", () => {
  it("targets getProduct and listProducts for the active company only", () => {
    expect(catalogStatusInvalidationKeys("company-a")).toEqual([
      [GET_PRODUCT_ACTION, "company-a"],
      [LIST_PRODUCTS_ACTION, "company-a"],
    ]);
  });

  it("invalidates after a successful write without touching other companies", () => {
    const queryClient = createShowzyQueryClient();
    const productKey = contractQueryKey(GET_PRODUCT_ACTION, "company-a", {
      productId: PRODUCT_ID,
    });
    const listKey = contractQueryKey(LIST_PRODUCTS_ACTION, "company-a", {
      status: "active",
    });
    const otherKey = contractQueryKey(GET_PRODUCT_ACTION, "company-b", {
      productId: PRODUCT_ID,
    });
    queryClient.setQueryData(productKey, { id: PRODUCT_ID });
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(otherKey, { id: PRODUCT_ID });

    invalidateCatalogAfterStatusWrite({
      queryClient,
      companyId: "company-a",
    });

    expect(queryClient.getQueryState(productKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);

    invalidateCatalogAfterStatusWrite({
      queryClient,
      companyId: null,
    });
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
