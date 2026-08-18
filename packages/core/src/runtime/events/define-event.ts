/**
 * `defineEvent` — the declaration half of the domain-event protocol
 * (fnd-T16 — core.md §6). A definition names one event, pins its payload
 * schema version and tenant/global scope, and owns the Zod schema `ctx.emit`
 * validates against. Definitions live in the emitting module's `events/`
 * directory (conventions.mdc); the module's action contracts declare the
 * names they emit, and the contract check (fnd-T10) proves every declared
 * name has exactly one registered definition with a scope consistent with
 * the emitter.
 *
 * Like `defineActionContract`, this validates everything checkable from one
 * definition in isolation and throws listing **all** violations. Registry
 * questions (duplicates across modules, emitter/scope consistency) belong
 * to the contract check.
 */
import { z } from "zod";

/**
 * `tenant` events carry the emitter's verified `companyId`; `global` events
 * carry none and may be declared only by global system and account emitters
 * (core.md §6, enforced registry-wide by the contract check).
 */
export type EventScope = "tenant" | "global";

/** Aggregate reference supplied at emit time (core.md §6 envelope). */
export interface EventAggregateRef {
  /** Aggregate kind, e.g. "order" — pairs with `id` for sequence scoping. */
  readonly type: string;
  /** Aggregate row UUID. */
  readonly id: string;
}

/** What a handler passes to `ctx.emit` alongside the definition. */
export interface EventEmission<TPayload extends z.ZodType = z.ZodType> {
  readonly aggregate: EventAggregateRef;
  /** Validated against the definition's schema at the `ctx.emit` call. */
  readonly payload: z.input<TPayload>;
}

/** The shape accepted by `defineEvent`. */
export interface EventDefinitionInput<TPayload extends z.ZodType = z.ZodType> {
  /** `<module>.<pastVerb>`, e.g. "orders.confirmed"; unique platform-wide. */
  readonly name: string;
  /**
   * Payload schema version, bumped on breaking payload change. Lives in the
   * envelope, never in the name (conventions.mdc).
   */
  readonly version: number;
  readonly scope: EventScope;
  readonly payload: TPayload;
}

declare const eventDefinitionBrand: unique symbol;

/**
 * A definition that passed define-time validation. The phantom brand keeps
 * hand-rolled objects out of `ctx.emit` and (fnd-T17) `defineEventHandler`,
 * mirroring the `ActionContract` brand.
 */
export type EventDefinition<TPayload extends z.ZodType = z.ZodType> = Readonly<
  EventDefinitionInput<TPayload>
> & { readonly [eventDefinitionBrand]: true };

/**
 * Thrown when a definition violates core.md §6 at define time. A
 * developer/CI error surfaced at module load — not part of the runtime
 * vocabulary (core.md §11) and never reaches a client.
 */
export class EventDefinitionError extends Error {
  readonly eventName: string;
  readonly problems: readonly string[];

  constructor(eventName: string, problems: readonly string[]) {
    const details = problems.map((problem) => `  - ${problem}`).join("\n");
    super(`Invalid event definition "${eventName}":\n${details}`);
    this.name = "EventDefinitionError";
    this.eventName = eventName;
    this.problems = problems;
  }
}

/**
 * `<module>.<pastVerb>` — camelCase segments, structurally the same pattern
 * `defineActionContract` applies to `emits` entries, so a definition and
 * the contracts declaring it can never disagree on what a valid name is.
 */
const EVENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;

const EVENT_SCOPES: ReadonlySet<string> = new Set(["tenant", "global"]);

/**
 * Validates and freezes an event definition. Throws `EventDefinitionError`
 * listing **all** violations, so a broken definition is fixed in one round.
 */
export function defineEvent<TPayload extends z.ZodType>(
  definition: EventDefinitionInput<TPayload>,
): EventDefinition<TPayload> {
  const problems: string[] = [];

  if (!EVENT_NAME_PATTERN.test(definition.name)) {
    problems.push(
      `name "${definition.name}" must be "<module>.<pastVerb>" with camelCase segments (e.g. "orders.confirmed")`,
    );
  }
  if (!Number.isInteger(definition.version) || definition.version <= 0) {
    problems.push("version must be a positive integer");
  }
  if (!EVENT_SCOPES.has(definition.scope)) {
    problems.push(`scope "${definition.scope}" must be "tenant" or "global"`);
  }
  if (!(definition.payload instanceof z.ZodType)) {
    problems.push("payload must be a Zod v4 schema");
  }

  if (problems.length > 0) {
    throw new EventDefinitionError(definition.name, problems);
  }
  // The brand is a compile-time marker for definitions that passed this
  // validation, so the single assertion is backed by the checks above.
  return Object.freeze({ ...definition }) as EventDefinition<TPayload>;
}
