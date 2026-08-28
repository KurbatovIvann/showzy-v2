import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import { customersWriteInvalidationKeys } from "./customer-cache";
import { LIST_CUSTOMERS_ACTION } from "./customer.queries";
import { LIST_GROUPS_ACTION } from "./group.queries";
import {
  bindCustomerStatusMutate,
  invalidateCustomersAfterWrite,
  type CustomerStatusWrite,
} from "./customer-status";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("bindCustomerStatusMutate", () => {
  it("routes archive and restore with the attempt options", async () => {
    const calls: Array<{
      readonly method: string;
      readonly id: string;
      readonly key: string;
    }> = [];
    const controller = createContractMutationController<
      CustomerStatusWrite,
      unknown
    >({
      mutate: bindCustomerStatusMutate({
        client: {
          customers: {
            archiveCustomer: (input, options: MutationCallOptions) => {
              calls.push({
                method: "archiveCustomer",
                id: input.id,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve({ id: input.id });
            },
            restoreCustomer: (input, options: MutationCallOptions) => {
              calls.push({
                method: "restoreCustomer",
                id: input.id,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve({ id: input.id });
            },
          },
        },
      }),
    });

    await controller.submit({
      kind: "archiveCustomer",
      id: CUSTOMER_ID,
    });
    await controller.submit({
      kind: "restoreCustomer",
      id: CUSTOMER_ID,
    });

    expect(calls.map((call) => call.method)).toEqual([
      "archiveCustomer",
      "restoreCustomer",
    ]);
    expect(calls.every((call) => call.key.length > 0)).toBe(true);
  });
});

describe("customersWriteInvalidationKeys", () => {
  it("targets listCustomers and listGroups for the active company only", () => {
    expect(customersWriteInvalidationKeys("company-a")).toEqual([
      [LIST_CUSTOMERS_ACTION, "company-a"],
      [LIST_GROUPS_ACTION, "company-a"],
    ]);
  });

  it("invalidates after a successful write without touching other companies", async () => {
    const queryClient = createShowzyQueryClient();
    const listKey = contractQueryKey(LIST_CUSTOMERS_ACTION, "company-a", {
      status: "active",
    });
    const otherKey = contractQueryKey(LIST_CUSTOMERS_ACTION, "company-b", {
      status: "active",
    });
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(otherKey, { items: [] });

    await invalidateCustomersAfterWrite({
      queryClient,
      companyId: "company-a",
    });

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);

    await invalidateCustomersAfterWrite({
      queryClient,
      companyId: null,
    });
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
