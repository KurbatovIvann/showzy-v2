import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import {
  boundContractMutate,
  createMutationBusyGuard,
} from "./bound-contract-mutation";
import { ClientUnavailableError } from "./errors";

const emptyOptions: MutationCallOptions = {
  context: { idempotencyKey: "attempt-1" },
};

describe("boundContractMutate", () => {
  it("rejects with ClientUnavailableError when the client is null", async () => {
    const getClient = (): { readonly id: string } | null => null;
    const mutate = boundContractMutate(
      getClient,
      () => () => Promise.resolve({ receiptId: "x" }),
    );
    await expect(mutate({ note: "x" }, emptyOptions)).rejects.toBeInstanceOf(
      ClientUnavailableError,
    );
  });

  it("calls the bound procedure when the client is ready", async () => {
    const seen: string[] = [];
    const mutate = boundContractMutate(
      () => ({ id: "client" }),
      (client) => (input: { note: string }) => {
        seen.push(`${client.id}:${input.note}`);
        return Promise.resolve({ receiptId: "r-1" });
      },
    );
    await expect(mutate({ note: "ready" }, emptyOptions)).resolves.toEqual({
      receiptId: "r-1",
    });
    expect(seen).toEqual(["client:ready"]);
  });
});

describe("createMutationBusyGuard", () => {
  it("drops a second submit while the first is in flight", async () => {
    const guard = createMutationBusyGuard();
    let resolveFirst!: () => void;
    const first = guard.run(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = () => {
            resolve("one");
          };
        }),
    );
    const second = await guard.run(() => Promise.resolve("two"));
    expect(second).toBeUndefined();
    resolveFirst();
    await expect(first).resolves.toBe("one");
    await expect(guard.run(() => Promise.resolve("three"))).resolves.toBe(
      "three",
    );
  });

  it("drops a submit when the mutation is already pending", async () => {
    const guard = createMutationBusyGuard();
    await expect(
      guard.run(() => Promise.resolve("nope"), true),
    ).resolves.toBeUndefined();
  });
});
