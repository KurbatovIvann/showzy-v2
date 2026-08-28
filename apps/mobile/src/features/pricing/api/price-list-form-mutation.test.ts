import { describe, expect, it } from "vitest";

import { isWireError, type MutationCallOptions } from "@showzy/contract";

import { describeQueryFailure } from "../../../api/errors";
import { createContractMutationController } from "../../../api/contract-mutation";
import {
  isPriceListFormRetryable,
  type PriceListFormWrite,
} from "../form/price-list-form-plan";
import { bindPriceListFormMutate } from "./price-list-form-mutation";

const LIST_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "33333333-3333-4333-8333-333333333333";

function unused(): Promise<never> {
  return Promise.reject(new Error("unused"));
}

function transport(overrides: {
  readonly createPriceList?: PriceListFormTransportPricing["createPriceList"];
  readonly updatePriceList?: PriceListFormTransportPricing["updatePriceList"];
  readonly setPriceListEntries?: PriceListFormTransportPricing["setPriceListEntries"];
  readonly removePriceListEntries?: PriceListFormTransportPricing["removePriceListEntries"];
  readonly setDefaultPriceList?: PriceListFormTransportPricing["setDefaultPriceList"];
  readonly activatePriceList?: PriceListFormTransportPricing["activatePriceList"];
  readonly deactivatePriceList?: PriceListFormTransportPricing["deactivatePriceList"];
}) {
  return {
    client: {
      pricing: {
        createPriceList: overrides.createPriceList ?? unused,
        updatePriceList: overrides.updatePriceList ?? unused,
        setPriceListEntries: overrides.setPriceListEntries ?? unused,
        removePriceListEntries: overrides.removePriceListEntries ?? unused,
        setDefaultPriceList: overrides.setDefaultPriceList ?? unused,
        activatePriceList: overrides.activatePriceList ?? unused,
        deactivatePriceList: overrides.deactivatePriceList ?? unused,
      },
    },
  };
}

type PriceListFormTransportPricing = Parameters<
  typeof bindPriceListFormMutate
>[0]["client"]["pricing"];

describe("bindPriceListFormMutate", () => {
  it("calls createPriceList with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{ readonly method: string; readonly key: string }> = [];
    const write: PriceListFormWrite = {
      kind: "createPriceList",
      input: { name: "Опт", isDefault: false, isActive: true },
    };
    const controller = createContractMutationController({
      mutate: bindPriceListFormMutate(
        transport({
          createPriceList: (input, options: MutationCallOptions) => {
            calls.push({
              method: "createPriceList",
              key: options.context.idempotencyKey,
            });
            expect(input.name).toBe("Опт");
            return Promise.reject(new TypeError("Failed to fetch"));
          },
        }),
      ),
    });

    await controller.submit(write).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe("createPriceList");
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });

  it("routes name, default, and product-level vs variant-level entry writes", async () => {
    const methods: string[] = [];
    const mutate = bindPriceListFormMutate(
      transport({
        updatePriceList: (input, options: MutationCallOptions) => {
          methods.push(`updatePriceList:${options.context.idempotencyKey}`);
          return Promise.resolve({ id: input.id });
        },
        setDefaultPriceList: (_input, options: MutationCallOptions) => {
          methods.push(`setDefault:${options.context.idempotencyKey}`);
          return Promise.resolve({ id: LIST_ID });
        },
        setPriceListEntries: (input, options: MutationCallOptions) => {
          methods.push(`setEntries:${options.context.idempotencyKey}`);
          expect(input.entries[0]).toEqual({
            productId: PRODUCT_ID,
            priceMinor: "0",
            currency: "UAH",
          });
          expect(input.entries[0]).not.toHaveProperty("variantId");
          return Promise.resolve({ items: [] });
        },
        removePriceListEntries: (input, options: MutationCallOptions) => {
          methods.push(`removeEntries:${options.context.idempotencyKey}`);
          expect(input.entries[0]).toEqual({
            productId: PRODUCT_ID,
            variantId: VARIANT_ID,
          });
          return Promise.resolve({ priceListId: input.priceListId });
        },
      }),
    );

    await mutate(
      {
        kind: "updatePriceList",
        input: { id: LIST_ID, name: "Партнери" },
      },
      { context: { idempotencyKey: "k1" } },
    );
    await mutate(
      { kind: "setDefault", priceListId: LIST_ID },
      { context: { idempotencyKey: "k2" } },
    );
    await mutate(
      {
        kind: "setEntries",
        input: {
          priceListId: LIST_ID,
          entries: [
            { productId: PRODUCT_ID, priceMinor: "0", currency: "UAH" },
          ],
        },
      },
      { context: { idempotencyKey: "k3" } },
    );
    await mutate(
      {
        kind: "removeEntries",
        input: {
          priceListId: LIST_ID,
          entries: [{ productId: PRODUCT_ID, variantId: VARIANT_ID }],
        },
      },
      { context: { idempotencyKey: "k4" } },
    );

    expect(methods[0]?.startsWith("updatePriceList:")).toBe(true);
    expect(methods[1]?.startsWith("setDefault:")).toBe(true);
    expect(methods[2]?.startsWith("setEntries:")).toBe(true);
    expect(methods[3]?.startsWith("removeEntries:")).toBe(true);
    expect(new Set(methods).size).toBe(4);
  });

  it("rejects a write that fails the contract wire schema before calling pricing", async () => {
    let pricingCalls = 0;
    const mutate = bindPriceListFormMutate(
      transport({
        createPriceList: () => {
          pricingCalls += 1;
          return Promise.reject(new Error("must-not-call"));
        },
      }),
    );
    const rejection = await mutate(
      {
        kind: "createPriceList",
        input: { name: "   ", isDefault: false, isActive: true },
      },
      { context: { idempotencyKey: "k-wire" } },
    ).then(
      () => null,
      (error: unknown) => error,
    );
    expect(pricingCalls).toBe(0);
    expect(isWireError(rejection) && rejection.code === "VALIDATION").toBe(
      true,
    );
    const kind = describeQueryFailure(rejection).kind;
    expect(kind).toBe("validation");
    expect(isPriceListFormRetryable(kind)).toBe(false);
  });
});
