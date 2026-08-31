/**
 * `defineEventHandler` — the subscription half of the domain-event
 * protocol (fnd-T17 — core.md §6). A subscription binds one consumed event
 * to one consuming module action under a stable consumer id
 * (`chat.order-card-updater`); it never accepts arbitrary DB logic — all
 * consumer effects run inside the bound action through the normal
 * execution pipeline.
 *
 * Like `defineEvent` and `implementAction`, this validates everything
 * checkable from the binding in isolation and throws listing **all**
 * violations. The same rules are re-proven registry-wide by the contract
 * check (fnd-T10, `collectSubscriptionProblems`), which additionally sees
 * duplicates across modules — feed it via `eventSubscriptionRefs`.
 */
import type {
  ActionPipelineDeps,
  PipelineRequestMeta,
  PrincipalInvocation,
} from "../pipeline/types.js";
import type { EventSubscriptionRef } from "../../contract-check/contract-check.js";
import type { AnyActionContract } from "../action-registry.js";
import type { ImplementedAction } from "../implement-action.js";
import { CONSUMER_NAME_PATTERN } from "../patterns.js";
import { executeAction } from "../pipeline/execute-action.js";
import type { EventDefinition } from "./define-event.js";
import type { z } from "zod";

/**
 * Thrown when a binding violates core.md §6 at define time. A
 * developer/CI error surfaced at module load — not part of the runtime
 * vocabulary (core.md §11) and never reaches a client.
 */
export class EventHandlerDefinitionError extends Error {
  readonly consumer: string;
  readonly problems: readonly string[];

  constructor(consumer: string, problems: readonly string[]) {
    const details = problems.map((problem) => `  - ${problem}`).join("\n");
    super(`Invalid event handler binding "${consumer}":\n${details}`);
    this.name = "EventHandlerDefinitionError";
    this.consumer = consumer;
    this.problems = problems;
  }
}

/** The shape accepted by `defineEventHandler`. */
export interface EventHandlerBinding<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  /** The consumed event's branded definition (the emitting module exports it). */
  readonly event: EventDefinition;
  /**
   * Stable consumer id, `<module>.<kebab-name>` (e.g.
   * "chat.order-card-updater"). It keys the `(consumer, eventId)` dedup
   * row, so renaming one orphans delivery state — treat it as persistent.
   */
  readonly consumer: string;
  /**
   * The bound action: transport-internal, AI-internal, system-principal,
   * write, idempotent, with `systemScope` matching the event's scope. Its
   * input schema must accept the event envelope (`eventEnvelopeSchema`).
   */
  readonly action: ImplementedAction<TInput, TOutput>;
}

/**
 * How the delivery entrypoint runs the bound action. The closure captures
 * the concrete `ImplementedAction` generics, so heterogeneous subscription
 * lists need no type erasure of the action itself.
 *
 * Internal to core — only `executeDelivery` (delivery.ts) calls it.
 */
export type EventSubscriptionInvoke = (
  deps: ActionPipelineDeps,
  invocation: {
    readonly input: unknown;
    readonly request: PipelineRequestMeta;
    readonly principal: PrincipalInvocation;
  },
) => Promise<unknown>;

declare const eventSubscriptionBrand: unique symbol;

/**
 * A binding that passed define-time validation. The phantom brand keeps
 * hand-rolled objects out of the dispatcher, mirroring `EventDefinition`
 * and `ImplementedAction`.
 */
export type EventSubscription = {
  readonly event: EventDefinition;
  readonly consumer: string;
  /** The bound action's contract — diagnostics and registry checks. */
  readonly contract: AnyActionContract;
  /** @internal Runs the bound action through the pipeline (delivery.ts). */
  readonly invoke: EventSubscriptionInvoke;
} & { readonly [eventSubscriptionBrand]: true };

/**
 * Validates and freezes an event subscription. Throws
 * `EventHandlerDefinitionError` listing **all** violations, so a broken
 * binding is fixed in one round.
 */
export function defineEventHandler<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(binding: EventHandlerBinding<TInput, TOutput>): EventSubscription {
  const { event, consumer, action } = binding;
  const contract = action.contract;
  const problems: string[] = [];

  if (!CONSUMER_NAME_PATTERN.test(consumer)) {
    problems.push(
      `consumer "${consumer}" must be "<module>.<kebab-name>" (e.g. "chat.order-card-updater")`,
    );
  }
  // The §6 binding contract, mirrored by the contract check: deliveries
  // run with a system context, off any transport, retried at-least-once.
  if (contract.principal !== "system") {
    problems.push(
      `bound action "${contract.name}" must be system-principal (core.md §6)`,
    );
  }
  if (contract.transport !== "internal") {
    problems.push(
      `bound action "${contract.name}" must be transport-internal (core.md §6)`,
    );
  }
  if (contract.aiExposure !== "internal") {
    problems.push(
      `bound action "${contract.name}" must be AI-internal (core.md §6)`,
    );
  }
  if (contract.risk !== "write") {
    problems.push(
      `bound action "${contract.name}" must declare risk: "write" (core.md §6)`,
    );
  }
  if (!contract.idempotent) {
    problems.push(
      `bound action "${contract.name}" must be idempotent — deliveries are at-least-once (core.md §6)`,
    );
  }
  if (contract.principal === "system" && contract.systemScope !== event.scope) {
    problems.push(
      `bound action "${contract.name}" has systemScope "${contract.systemScope ?? "unknown"}" but "${event.name}" is ${event.scope}-scoped — core invokes the consumer with a system context matching the event's company scope (core.md §6)`,
    );
  }

  if (problems.length > 0) {
    throw new EventHandlerDefinitionError(consumer, problems);
  }

  const invoke: EventSubscriptionInvoke = (deps, invocation) =>
    executeAction(deps, {
      action,
      input: invocation.input,
      request: invocation.request,
      principal: invocation.principal,
    });
  // Schema generics erase for storage (heterogeneous subscription lists);
  // the closure above keeps the concrete action fully typed.
  const erasedContract: AnyActionContract = contract;

  // The brand is a compile-time marker for bindings that passed this
  // validation, so the single assertion is backed by the checks above.
  return Object.freeze({
    event,
    consumer,
    contract: erasedContract,
    invoke,
  }) as EventSubscription;
}

/**
 * Maps subscriptions to the structural refs the contract check walks
 * (fnd-T10 `ContractCheckInput.subscriptions`). Composition roots collect
 * every module's subscriptions and pass the result to the CI stage.
 */
export function eventSubscriptionRefs(
  subscriptions: readonly EventSubscription[],
): EventSubscriptionRef[] {
  return subscriptions.map((subscription) => ({
    event: subscription.event.name,
    consumer: subscription.consumer,
    action: subscription.contract.name,
  }));
}
