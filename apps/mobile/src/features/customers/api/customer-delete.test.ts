import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../../api/contract-mutation";
import { bindCustomerDeleteMutate } from "./customer-delete";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("bindCustomerDeleteMutate", () => {
  it("forwards id and attempt options to deleteCustomer", async () => {
    const keys: string[] = [];
    const controller = createContractMutationController<
      { id: string },
      { id: string }
    >({
      mutate: bindCustomerDeleteMutate({
        client: {
          customers: {
            deleteCustomer: (input, options: MutationCallOptions) => {
              keys.push(options.context.idempotencyKey);
              return Promise.resolve({ id: input.id });
            },
          },
        },
      }),
    });

    const result = await controller.submit({ id: CUSTOMER_ID });
    expect(result).toEqual({ id: CUSTOMER_ID });
    expect(keys[0]?.length).toBeGreaterThan(0);
  });
});
