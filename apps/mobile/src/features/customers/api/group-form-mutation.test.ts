import { describe, expect, it } from "vitest";

import { isWireError, type MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { bindGroupFormMutate } from "./group-form-mutation";
import type { GroupFormWrite } from "../groups/group-form-plan";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRICE_LIST_ID = "22222222-2222-4222-8222-222222222222";

describe("bindGroupFormMutate", () => {
  it("calls createGroup with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly method: string;
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const write: GroupFormWrite = {
      kind: "createGroup",
      input: { name: "Опт", description: "Для гурту", priceListId: null },
    };
    const controller = createContractMutationController({
      mutate: bindGroupFormMutate({
        client: {
          customers: {
            createGroup: (input, options: MutationCallOptions) => {
              calls.push({
                method: "createGroup",
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.reject(new TypeError("Failed to fetch"));
            },
            updateGroup: () => Promise.reject(new Error("unused")),
          },
        },
      }),
    });

    await controller.submit(write).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.method).toBe("createGroup");
    expect(calls[0]?.input).toEqual({
      name: "Опт",
      description: "Для гурту",
      priceListId: null,
    });
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });

  it("rejects a create payload that fails the wire schema before calling transport", async () => {
    const mutate = bindGroupFormMutate({
      client: {
        customers: {
          createGroup: () => Promise.reject(new Error("unused")),
          updateGroup: () => Promise.reject(new Error("unused")),
        },
      },
    });
    const result = mutate(
      {
        kind: "createGroup",
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

  it("calls updateGroup with inherit nulls and rejects a bad payload before transport", async () => {
    const calls: unknown[] = [];
    const mutate = bindGroupFormMutate({
      client: {
        customers: {
          createGroup: () => Promise.reject(new Error("unused")),
          updateGroup: (input) => {
            calls.push(input);
            return Promise.resolve({ id: input.id });
          },
        },
      },
    });
    await expect(
      mutate(
        {
          kind: "updateGroup",
          input: {
            id: GROUP_ID,
            name: "VIP",
            description: "",
            priceListId: PRICE_LIST_ID,
          },
        },
        { context: { idempotencyKey: "k" } },
      ),
    ).resolves.toEqual({ id: GROUP_ID });
    expect(calls).toEqual([
      {
        id: GROUP_ID,
        name: "VIP",
        description: "",
        priceListId: PRICE_LIST_ID,
      },
    ]);

    const rejected = mutate(
      {
        kind: "updateGroup",
        input: {
          id: "not-a-uuid",
          name: "",
          description: "",
          priceListId: null,
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
