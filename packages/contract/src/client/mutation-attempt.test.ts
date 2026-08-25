import { describe, expect, it } from "vitest";

import { createMutationAttempt } from "./mutation-attempt.js";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("createMutationAttempt (contract.md §3, core.md §5)", () => {
  it("mints one UUID and reuses it across retries of the same submit", () => {
    const attempt = createMutationAttempt();
    expect(attempt.key).toMatch(UUID_V4);
    expect(attempt.options.context.idempotencyKey).toBe(attempt.key);

    const first = attempt.options;
    const retry = attempt.options;
    expect(retry.context.idempotencyKey).toBe(first.context.idempotencyKey);
    expect(retry).toBe(first);
  });

  it("does not retry HTTP itself — callers must pass attempt.options (contract.md §3)", () => {
    const attempt = createMutationAttempt();
    expect(attempt).not.toHaveProperty("retry");
    expect(typeof attempt.options).toBe("object");
  });

  it("keeps the same key when attaching a confirmation challenge", () => {
    const attempt = createMutationAttempt();
    const confirmed = attempt.withChallenge("challenge-1");
    expect(confirmed.context.idempotencyKey).toBe(attempt.key);
    expect(confirmed.context.confirmationChallengeId).toBe("challenge-1");
  });

  it("gives each logical submit its own key", () => {
    const first = createMutationAttempt();
    const second = createMutationAttempt();
    expect(first.key).not.toBe(second.key);
  });

  it("mints a UUID v4 from getRandomValues when randomUUID is missing", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues(target: Uint8Array) {
          target.fill(0x11);
          return target;
        },
      },
    });
    try {
      const attempt = createMutationAttempt();
      expect(attempt.key).toBe("11111111-1111-4111-9111-111111111111");
      expect(attempt.key).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("falls through to getRandomValues when randomUUID throws Illegal invocation", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID() {
          throw new TypeError("Illegal invocation");
        },
        getRandomValues(target: Uint8Array) {
          target.fill(0x22);
          return target;
        },
      },
    });
    try {
      const attempt = createMutationAttempt();
      expect(attempt.key).toBe("22222222-2222-4222-a222-222222222222");
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("uses an injected key factory when Web Crypto is unavailable", () => {
    const attempt = createMutationAttempt(
      () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    expect(attempt.key).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(attempt.options.context.idempotencyKey).toBe(attempt.key);
  });
});
