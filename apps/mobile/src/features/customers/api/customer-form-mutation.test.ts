import { describe, expect, it } from "vitest";

import { isWireError, type MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { bindCustomerFormMutate } from "./customer-form-mutation";
import type { CustomerFormWrite } from "../form/customer-form-plan";

describe("bindCustomerFormMutate", () => {
  it("calls createCustomer with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly method: string;
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const write: CustomerFormWrite = {
      kind: "createCustomer",
      input: { name: "Марія", phone: "+38067" },
    };
    const controller = createContractMutationController({
      mutate: bindCustomerFormMutate({
        client: {
          customers: {
            createCustomer: (input, options: MutationCallOptions) => {
              calls.push({
                method: "createCustomer",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.reject(new TypeError("Failed to fetch"));
            },
            updateCustomer: () => Promise.reject(new Error("unused")),
          },
        },
      }),
    });

    await controller.submit(write).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe("createCustomer");
    expect(calls[0]?.input).toEqual({
      name: "Марія",
      phone: "+38067",
    });
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });

  it("rejects a create payload that fails the wire schema before calling transport", async () => {
    const mutate = bindCustomerFormMutate({
      client: {
        customers: {
          createCustomer: () => Promise.reject(new Error("unused")),
          updateCustomer: () => Promise.reject(new Error("unused")),
        },
      },
    });
    const result = mutate(
      {
        kind: "createCustomer",
        input: { name: "" },
      },
      {
        context: { idempotencyKey: "k" },
      },
    );
    await expect(result).rejects.toSatisfy(
      (error: unknown) => isWireError(error) && error.code === "VALIDATION",
    );
  });
});
