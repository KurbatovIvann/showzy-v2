import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { bindCounterpartyDeleteMutate } from "./counterparty-delete";

const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";

describe("bindCounterpartyDeleteMutate", () => {
  it("forwards id and attempt options to deleteCounterparty", async () => {
    const keys: string[] = [];
    const controller = createContractMutationController<
      { id: string },
      { id: string }
    >({
      mutate: bindCounterpartyDeleteMutate({
        client: {
          customers: {
            deleteCounterparty: (input, options: MutationCallOptions) => {
              keys.push(options.context.idempotencyKey);
              return Promise.resolve({ id: input.id });
            },
          },
        },
      }),
    });

    const result = await controller.submit({ id: COUNTERPARTY_ID });
    expect(result).toEqual({ id: COUNTERPARTY_ID });
    expect(keys[0]?.length).toBeGreaterThan(0);
  });
});
