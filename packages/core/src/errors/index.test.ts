import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ConcurrentRetryError,
  ConfirmationRequiredError,
  ConflictError,
  CoreError,
  CoreInvariantError,
  IdempotencyConflictError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "./index.js";
import type { CoreErrorCode } from "./index.js";

/** One representative instance of every class in the §11 vocabulary. */
function instantiateAll(): readonly CoreError[] {
  return [
    new ValidationError([]),
    new PermissionDeniedError(),
    new NotFoundError(),
    new ConflictError("Order is already confirmed."),
    new IdempotencyConflictError(),
    new ConcurrentRetryError(3),
    new ConfirmationRequiredError({
      challengeId: "b9e6f3f2-0000-4000-8000-000000000000",
      summary: "Disable feature X for company Y",
      expiresAt: "2026-08-18T10:00:00.000Z",
    }),
    new RateLimitError(60),
    new TimeoutError(),
    new CoreInvariantError("tenant leak: company mismatch in nested call"),
  ];
}

describe("core error codes are stable wire codes (contract.md §4)", () => {
  // Pinning test: these literals are the wire contract. A code change here
  // is a breaking API change and must go through spec rework, never a
  // casual rename.
  const expectedCodes: readonly [CoreError, CoreErrorCode][] = [
    [new ValidationError([]), "VALIDATION"],
    [new PermissionDeniedError(), "PERMISSION_DENIED"],
    [new NotFoundError(), "NOT_FOUND"],
    [new ConflictError("conflict"), "CONFLICT"],
    [new IdempotencyConflictError(), "IDEMPOTENCY_CONFLICT"],
    [new ConcurrentRetryError(1), "RETRY_IN_PROGRESS"],
    [
      new ConfirmationRequiredError({
        challengeId: "id",
        summary: "summary",
        expiresAt: "2026-08-18T10:00:00.000Z",
      }),
      "CONFIRMATION_REQUIRED",
    ],
    [new RateLimitError(1), "RATE_LIMITED"],
    [new TimeoutError(), "TIMEOUT"],
    [new CoreInvariantError("bug"), "INTERNAL"],
  ];

  it.each(expectedCodes.map(([error, code]) => [error.name, error, code]))(
    "%s has code %s",
    (_name, error, code) => {
      expect(error.code).toBe(code);
    },
  );

  it("covers all ten §11 classes", () => {
    expect(new Set(instantiateAll().map((error) => error.name)).size).toBe(10);
  });
});

describe("client-safe messages", () => {
  it("every class carries a non-empty client-safe message by default", () => {
    for (const error of instantiateAll()) {
      expect(error.clientMessage.length, error.name).toBeGreaterThan(0);
    }
  });

  it("message defaults to the client message when no internal detail is given", () => {
    const error = new NotFoundError();
    expect(error.message).toBe(error.clientMessage);
  });

  it("internal details go to Error#message (logs), never clientMessage", () => {
    const error = new NotFoundError("The requested order was not found.", {
      internalMessage:
        "order 0198c5... belongs to company B, requested by staff of company A",
    });
    expect(error.message).toContain("company B");
    expect(error.clientMessage).toBe("The requested order was not found.");
    expect(error.clientMessage).not.toContain("company B");
  });

  it("CoreInvariantError keeps its description internal-only", () => {
    const error = new CoreInvariantError(
      "call cycle detected: orders.create -> pricing.resolveProductPrices -> orders.create",
    );
    expect(error.message).toContain("call cycle detected");
    expect(error.clientMessage).toBe("Internal error.");
    expect(error.clientMessage).not.toContain("cycle");
  });

  it("preserves a cause chain for logging", () => {
    const cause = new Error("connect ECONNREFUSED 127.0.0.1:6379");
    const error = new RateLimitError(30, undefined, { cause });
    expect(error.cause).toBe(cause);
    expect(error.clientMessage).not.toContain("ECONNREFUSED");
  });
});

describe("typed extras carried for the contract layer", () => {
  it("ValidationError carries Zod issues", () => {
    const parsed = z.object({ customerId: z.uuid() }).safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const error = new ValidationError(parsed.error.issues);
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]?.path).toEqual(["customerId"]);
  });

  it("ConcurrentRetryError and RateLimitError carry retryAfterSec", () => {
    expect(new ConcurrentRetryError(7).retryAfterSec).toBe(7);
    expect(new RateLimitError(42).retryAfterSec).toBe(42);
  });

  it("ConfirmationRequiredError carries the redacted challenge", () => {
    const error = new ConfirmationRequiredError({
      challengeId: "challenge-1",
      summary: "Cancel payment of 150.00 UAH for order #42",
      expiresAt: "2026-08-18T10:05:00.000Z",
    });
    expect(error.challenge.challengeId).toBe("challenge-1");
    expect(error.challenge.summary).toContain("Cancel payment");
    expect(error.challenge.expiresAt).toBe("2026-08-18T10:05:00.000Z");
  });
});

describe("class identity", () => {
  it("all classes extend CoreError and Error with a matching name", () => {
    for (const error of instantiateAll()) {
      expect(error).toBeInstanceOf(CoreError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(error.constructor.name);
    }
  });
});
