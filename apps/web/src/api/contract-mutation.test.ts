import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "./contract-mutation";

describe("createContractMutationController", () => {
  it("mints one attempt per submit and reuses it on retry and confirm", async () => {
    const calls: MutationCallOptions[] = [];
    const controller = createContractMutationController<
      { readonly name: string },
      { readonly ok: true }
    >({
      mutate: (_input, options) => {
        calls.push(options);
        return Promise.resolve({ ok: true });
      },
    });

    await controller.submit({ name: "Cafe" });
    await controller.retry();
    await controller.confirm("challenge-1");

    expect(calls).toHaveLength(3);
    expect(calls[0]?.context.idempotencyKey).toBe(
      calls[1]?.context.idempotencyKey,
    );
    expect(calls[1]?.context.idempotencyKey).toBe(
      calls[2]?.context.idempotencyKey,
    );
    expect(calls[0]?.context.confirmationChallengeId).toBeUndefined();
    expect(calls[1]?.context.confirmationChallengeId).toBeUndefined();
    expect(calls[2]?.context.confirmationChallengeId).toBe("challenge-1");
  });

  it("mints a new key on a later submit", async () => {
    const keys: string[] = [];
    const controller = createContractMutationController<
      { readonly n: number },
      { readonly ok: true }
    >({
      mutate: (_input, options) => {
        keys.push(options.context.idempotencyKey);
        return Promise.resolve({ ok: true });
      },
    });

    await controller.submit({ n: 1 });
    await controller.submit({ n: 2 });
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("does not auto-retry a failed submit", async () => {
    let calls = 0;
    const controller = createContractMutationController({
      mutate: () => {
        calls += 1;
        return Promise.reject(new TypeError("Failed to fetch"));
      },
    });
    await controller.submit({}).catch(() => {});
    expect(calls).toBe(1);
  });
});
