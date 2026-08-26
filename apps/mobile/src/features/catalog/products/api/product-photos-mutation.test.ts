import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../../api/contract-mutation";
import { bindSetProductImages } from "./product-photos-mutation";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("bindSetProductImages", () => {
  it("calls catalog.setProductImages with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly fileIds: readonly string[];
      readonly key: string;
    }> = [];
    const controller = createContractMutationController({
      mutate: bindSetProductImages({
        client: {
          catalog: {
            setProductImages: (input, options: MutationCallOptions) => {
              calls.push({
                fileIds: input.fileIds,
                key: options.context.idempotencyKey,
              });
              return Promise.reject(new TypeError("Failed to fetch"));
            },
          },
        },
      }),
    });
    const input = { productId: PRODUCT_ID, fileIds: [FILE_A] };
    await controller.submit(input).catch(() => {});
    await controller.retry().catch(() => {});
    expect(calls).toHaveLength(2);
    expect(calls[0]?.fileIds).toEqual([FILE_A]);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });
});
