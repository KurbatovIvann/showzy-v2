import { describe, expect, it } from "vitest";

import { isWireError, type MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { bindCounterpartyFormMutate } from "./counterparty-form-mutation";
import type { CounterpartyFormWrite } from "../counterparties/counterparty-form-plan";

const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("bindCounterpartyFormMutate", () => {
  it("calls createCounterparty with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly method: string;
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const write: CounterpartyFormWrite = {
      kind: "createCounterparty",
      input: { name: "ФОП Іваненко", customerId: null },
    };
    const controller = createContractMutationController({
      mutate: bindCounterpartyFormMutate({
        client: {
          customers: {
            createCounterparty: (input, options: MutationCallOptions) => {
              calls.push({
                method: "createCounterparty",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.reject(new TypeError("Failed to fetch"));
            },
            updateCounterparty: () => Promise.reject(new Error("unused")),
          },
        },
      }),
    });

    await controller.submit(write).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe("createCounterparty");
    expect(calls[0]?.input).toEqual({
      name: "ФОП Іваненко",
      customerId: null,
    });
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });

  it("rejects a create payload that fails the wire schema before calling transport", async () => {
    const mutate = bindCounterpartyFormMutate({
      client: {
        customers: {
          createCounterparty: () => Promise.reject(new Error("unused")),
          updateCounterparty: () => Promise.reject(new Error("unused")),
        },
      },
    });
    const result = mutate(
      {
        kind: "createCounterparty",
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

  it("calls updateCounterparty with null unlink and rejects a bad payload before transport", async () => {
    const calls: unknown[] = [];
    const mutate = bindCounterpartyFormMutate({
      client: {
        customers: {
          createCounterparty: () => Promise.reject(new Error("unused")),
          updateCounterparty: (input) => {
            calls.push(input);
            return Promise.resolve({ id: input.id });
          },
        },
      },
    });
    await expect(
      mutate(
        {
          kind: "updateCounterparty",
          input: {
            id: COUNTERPARTY_ID,
            name: "ФОП Іваненко",
            edrpou: null,
            legalAddress: null,
            iban: null,
            bankName: null,
            bankMfo: null,
            phone: null,
            email: null,
            notes: null,
            customerId: null,
          },
        },
        { context: { idempotencyKey: "k" } },
      ),
    ).resolves.toEqual({ id: COUNTERPARTY_ID });
    expect(calls).toEqual([
      {
        id: COUNTERPARTY_ID,
        name: "ФОП Іваненко",
        edrpou: null,
        legalAddress: null,
        iban: null,
        bankName: null,
        bankMfo: null,
        phone: null,
        email: null,
        notes: null,
        customerId: null,
      },
    ]);

    const rejected = mutate(
      {
        kind: "updateCounterparty",
        input: {
          id: "not-a-uuid",
          name: "",
          customerId: CUSTOMER_ID,
        },
      },
      { context: { idempotencyKey: "k" } },
    );
    await expect(rejected).rejects.toSatisfy(
      (error: unknown) => isWireError(error) && error.code === "VALIDATION",
    );
    expect(calls).toHaveLength(1);
  });
});
