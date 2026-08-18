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
});
