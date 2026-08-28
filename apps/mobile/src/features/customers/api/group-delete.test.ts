import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../../api/contract-mutation";
import { bindGroupDeleteMutate } from "./group-delete";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("bindGroupDeleteMutate", () => {
  it("forwards id and attempt options to deleteGroup", async () => {
    const keys: string[] = [];
    const controller = createContractMutationController<
      { id: string },
      { id: string }
    >({
      mutate: bindGroupDeleteMutate({
        client: {
          customers: {
            deleteGroup: (input, options: MutationCallOptions) => {
              keys.push(options.context.idempotencyKey);
              return Promise.resolve({ id: input.id });
            },
          },
        },
      }),
    });

    const result = await controller.submit({ id: GROUP_ID });
    expect(result).toEqual({ id: GROUP_ID });
    expect(keys[0]?.length).toBeGreaterThan(0);
  });
});
