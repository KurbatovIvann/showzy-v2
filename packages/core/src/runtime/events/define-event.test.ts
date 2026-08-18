/**
 * Define-time validation of event definitions (fnd-T16 — core.md §6).
 * Registry-wide rules (duplicate names across modules, emitter/scope
 * consistency) are the contract check's job and are tested in fnd-T10's
 * suite; here only the single-definition rules.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  defineEvent,
  EventDefinitionError,
  type EventDefinitionInput,
} from "./define-event.js";

function problemsOf(run: () => unknown): readonly string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof EventDefinitionError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error("expected an EventDefinitionError");
}

/**
 * Runs `defineEvent` over a deliberately mis-shaped input: the loose
 * parameter type widens what `EventDefinitionInput` forbids, so the runtime
 * rejection paths stay testable without type suppressions (same approach as
 * the permissive `defineActionContract` input).
 */
function defineLoose(input: {
  readonly name: string;
  readonly version: number;
  readonly scope: string;
  readonly payload: unknown;
}): () => unknown {
  return () => defineEvent(input as EventDefinitionInput);
}

describe("defineEvent — valid definitions", () => {
  it("accepts and freezes a valid tenant event", () => {
    const definition = defineEvent({
      name: "orders.created",
      version: 1,
      scope: "tenant",
      payload: z.object({ orderId: z.uuid() }),
    });

    expect(definition.name).toBe("orders.created");
    expect(definition.version).toBe(1);
    expect(definition.scope).toBe("tenant");
    expect(Object.isFrozen(definition)).toBe(true);
  });

  it("accepts a global event", () => {
    const definition = defineEvent({
      name: "referenceData.dictionarySynced",
      version: 3,
      scope: "global",
      payload: z.object({ entries: z.number().int() }),
    });

    expect(definition.scope).toBe("global");
    expect(definition.version).toBe(3);
  });
});

describe("defineEvent — rejections", () => {
  it.each([
    "OrdersCreated",
    "orders.Created",
    "orders_created",
    "orders.created.v2",
    "orders.",
    ".created",
    "",
  ])('rejects the malformed name "%s"', (name) => {
    const problems = problemsOf(() =>
      defineEvent({
        name,
        version: 1,
        scope: "tenant",
        payload: z.object({}),
      }),
    );
    expect(problems).toEqual([
      expect.stringContaining('"<module>.<pastVerb>"'),
    ]);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects the invalid version %s",
    (version) => {
      const problems = problemsOf(() =>
        defineEvent({
          name: "orders.created",
          version,
          scope: "tenant",
          payload: z.object({}),
        }),
      );
      expect(problems).toEqual([expect.stringContaining("positive integer")]);
    },
  );

  it("rejects an unknown scope", () => {
    const run = defineLoose({
      name: "orders.created",
      version: 1,
      scope: "company",
      payload: z.object({}),
    });

    expect(problemsOf(run)).toEqual([
      expect.stringContaining('"tenant" or "global"'),
    ]);
  });

  it("rejects a payload that is not a Zod schema", () => {
    const run = defineLoose({
      name: "orders.created",
      version: 1,
      scope: "tenant",
      payload: { parse: () => undefined },
    });

    expect(problemsOf(run)).toEqual([expect.stringContaining("Zod v4 schema")]);
  });

  it("collects every violation into one error", () => {
    const run = defineLoose({
      name: "not a name",
      version: 0,
      scope: "everywhere",
      payload: {},
    });

    expect(problemsOf(run)).toHaveLength(4);
  });
});
