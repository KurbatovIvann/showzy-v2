import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import {
  GET_PRICE_LIST_ACTION,
  priceListsWriteInvalidationKeys,
} from "./price-list-cache";
import { LIST_PRICE_LISTS_ACTION } from "./price-list.queries";
import {
  bindPriceListStatusMutate,
  invalidatePriceListsAfterWrite,
  type PriceListStatusWrite,
} from "./price-list-status";

const PRICE_LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("bindPriceListStatusMutate", () => {
  it("routes setDefault, clearDefault, activate, and deactivate", async () => {
    const calls: string[] = [];
    const controller = createContractMutationController<
      PriceListStatusWrite,
      unknown
    >({
      mutate: bindPriceListStatusMutate({
        client: {
          pricing: {
            setDefaultPriceList: (input, options: MutationCallOptions) => {
              calls.push(
                `setDefault:${String(input.priceListId)}:${options.context.idempotencyKey.length > 0 ? "true" : "false"}`,
              );
              return Promise.resolve(null);
            },
            activatePriceList: (input, options: MutationCallOptions) => {
              calls.push(
                `activate:${input.id}:${options.context.idempotencyKey.length > 0 ? "true" : "false"}`,
              );
              return Promise.resolve({ id: input.id });
            },
            deactivatePriceList: (input, options: MutationCallOptions) => {
              calls.push(
                `deactivate:${input.id}:${options.context.idempotencyKey.length > 0 ? "true" : "false"}`,
              );
              return Promise.resolve({ id: input.id });
            },
          },
        },
      }),
    });

    await controller.submit({
      kind: "setDefault",
      priceListId: PRICE_LIST_ID,
    });
    await controller.submit({ kind: "clearDefault" });
    await controller.submit({ kind: "activate", id: PRICE_LIST_ID });
    await controller.submit({ kind: "deactivate", id: PRICE_LIST_ID });

    expect(calls).toEqual([
      `setDefault:${PRICE_LIST_ID}:true`,
      "setDefault:null:true",
      `activate:${PRICE_LIST_ID}:true`,
      `deactivate:${PRICE_LIST_ID}:true`,
    ]);
  });
});

describe("priceListsWriteInvalidationKeys", () => {
  it("targets listPriceLists and getPriceList for the active company only", () => {
    expect(priceListsWriteInvalidationKeys("company-a")).toEqual([
      [LIST_PRICE_LISTS_ACTION, "company-a"],
      [GET_PRICE_LIST_ACTION, "company-a"],
    ]);
  });

  it("invalidates after a successful write without touching other companies", async () => {
    const queryClient = createShowzyQueryClient();
    const listKey = contractQueryKey(LIST_PRICE_LISTS_ACTION, "company-a", {
      availability: "all",
    });
    const otherKey = contractQueryKey(LIST_PRICE_LISTS_ACTION, "company-b", {
      availability: "all",
    });
    const pickerKey = contractQueryKey(LIST_PRICE_LISTS_ACTION, "company-a", {
      limit: 50,
    });
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(otherKey, { items: [] });
    queryClient.setQueryData(pickerKey, { items: [] });

    await invalidatePriceListsAfterWrite({
      queryClient,
      companyId: "company-a",
    });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(pickerKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);

    await invalidatePriceListsAfterWrite({
      queryClient,
      companyId: null,
    });
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
