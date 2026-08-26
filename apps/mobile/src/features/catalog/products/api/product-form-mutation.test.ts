import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../../api/contract-mutation";
import type { ProductFormWrite } from "../form/product-form-model";
import { bindProductFormMutate } from "./product-form-mutation";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("bindProductFormMutate", () => {
  it("calls createProduct with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly method: string;
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const write: ProductFormWrite = {
      kind: "createProduct",
      input: {
        name: "Торт",
        basePriceMinor: "150000",
        currency: "UAH",
        variants: [{ name: "1 кг" }],
      },
      variantKeys: ["draft-1"],
    };
    const controller = createContractMutationController({
      mutate: bindProductFormMutate({
        client: {
          catalog: {
            createProduct: (input, options: MutationCallOptions) => {
              calls.push({
                method: "createProduct",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.reject(new TypeError("Failed to fetch"));
            },
            updateProduct: () => Promise.reject(new Error("unused")),
            createVariant: () => Promise.reject(new Error("unused")),
            updateVariant: () => Promise.reject(new Error("unused")),
          },
        },
      }),
    });

    await controller.submit(write).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe("createProduct");
    expect(calls[0]?.input).toEqual(write.input);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });

  it("routes edit writes to updateProduct and createVariant", async () => {
    const methods: string[] = [];
    const mutate = bindProductFormMutate({
      client: {
        catalog: {
          createProduct: () => Promise.reject(new Error("unused")),
          updateProduct: (input, options: MutationCallOptions) => {
            methods.push(`updateProduct:${options.context.idempotencyKey}`);
            return Promise.resolve({ productId: input.productId });
          },
          createVariant: (_input, options: MutationCallOptions) => {
            methods.push(`createVariant:${options.context.idempotencyKey}`);
            return Promise.resolve({ variantId: "v-1" });
          },
          updateVariant: () => Promise.reject(new Error("unused")),
        },
      },
    });
    const product = await mutate(
      {
        kind: "updateProduct",
        input: {
          productId: PRODUCT_ID,
          name: "Торт",
          basePriceMinor: "100",
          currency: "UAH",
        },
      },
      { context: { idempotencyKey: "k1" } },
    );
    const variant = await mutate(
      {
        kind: "createVariant",
        key: "draft-1",
        input: { productId: PRODUCT_ID, name: "Міні" },
      },
      { context: { idempotencyKey: "k2" } },
    );
    expect(product).toEqual({ kind: "product", productId: PRODUCT_ID });
    expect(variant).toEqual({ kind: "variant", variantId: "v-1" });
    expect(methods[0]?.startsWith("updateProduct:")).toBe(true);
    expect(methods[1]?.startsWith("createVariant:")).toBe(true);
    expect(methods[0]).not.toBe(methods[1]);
  });
});
