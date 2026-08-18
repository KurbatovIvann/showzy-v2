/**
 * The registry-walking contract check (core.md §2, fnd-T10) — the CI gate
 * that fails on every §2 rule violation.
 *
 * Enforcement is layered; the CI stage executes all three layers:
 *
 * 1. **Define time** — `defineActionContract` throws on every rule checkable
 *    from one descriptor in isolation (metadata completeness,
 *    principal/transport/AI combinations, read-only principal subsets,
 *    confirmation implications, `emits` naming, audit implications). Merely
 *    importing a module barrel in the stage runs this layer.
 * 2. **Implement/registration time** — `implementAction` enforces the
 *    conditional callbacks (`resolveTarget`, `confirmationSummary`,
 *    `auditTarget`); `ActionRegistry` rejects duplicate names and
 *    `assertPaired()` rejects orphan descriptors/implementations.
 * 3. **Registry-wide** — this module: rules that need the whole registry
 *    plus the event/subscription/call-graph/grant manifests. These cannot
 *    be checked from a single definition and are collected here into one
 *    report.
 *
 * Layers 1–2 throw on the first broken definition; this layer aggregates,
 * so a red CI run lists every registry-wide problem at once.
 */
import type { ActionContract } from "../contract/types.js";
import {
  ActionRegistry,
  ActionRegistryError,
} from "../runtime/action-registry.js";
import { callTargetProblems, describePrincipal } from "./call-rules.js";

/**
 * Thrown by `assertContractCheck` with every collected violation. Like the
 * define/implement-time errors, this is a developer/CI error — not part of
 * the runtime vocabulary (core.md §11) and never reaches a client.
 */
export class ContractCheckError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    const details = problems.map((problem) => `  - ${problem}`).join("\n");
    super(`Contract check failed:\n${details}`);
    this.name = "ContractCheckError";
    this.problems = problems;
  }
}

/**
 * The registered shape of a domain event definition (core.md §6). A
 * structural subset of what `defineEvent` (fnd-T16) produces — the check
 * needs only identity and scope; payload schemas are validated at emit
 * time.
 */
export interface EventDefinitionRef {
  readonly name: string;
  readonly scope: "tenant" | "global";
}

/**
 * One event subscription (core.md §6). A structural subset of what
 * `defineEventHandler` (fnd-T17) produces: the consumed event, the stable
 * consumer name (e.g. `chat.order-card-updater`), and the bound action.
 */
export interface EventSubscriptionRef {
  readonly event: string;
  readonly consumer: string;
  readonly action: string;
}

/**
 * One declared cross-module `ctx.call` edge (ADR-0015). Module specs list
 * the actions a module calls; composition supplies those declarations here
 * so CI proves every target is a principal-compatible read before runtime
 * (fnd-T19) ever executes one.
 */
export interface DeclaredCallEdge {
  readonly caller: string;
  readonly callee: string;
}

/**
 * One read-model grant from the schema-ownership manifest (ADR-0015 §3):
 * the owning module's spec grants a cross-cutting projection module
 * read-only access to its tables.
 */
export interface ReadModelGrantRef {
  /** Module that owns the schema and declares the grant in its spec. */
  readonly owner: string;
  /** Projection module receiving read access (`search` | `analytics`). */
  readonly grantee: string;
}

/**
 * One module-to-schema import edge from the schema-ownership manifest
 * (ADR-0014: a module imports only its own schema file). Foreign edges are
 * legal only when a matching read-model grant exists.
 */
export interface SchemaImportRef {
  /** Module whose code imports the schema file. */
  readonly importer: string;
  /** Module that owns the imported `packages/db/src/schema/<module>.ts`. */
  readonly schemaOwner: string;
}

/**
 * Grant lookup — `ProjectionGrantManifest` from `@showzy/db` satisfies this
 * structurally (as does a plain `Set` of grant ids in tests), keeping core
 * free of a database dependency until the runtime tasks need one.
 */
export interface ProjectionGrantLookup {
  has(grantId: string): boolean;
}

/**
 * Everything the check walks. All manifests are required so a composition
 * root cannot silently skip a rule class by omitting an input — an empty
 * collection is an explicit statement that nothing of that kind exists.
 */
export interface ContractCheckInput {
  readonly registry: ActionRegistry;
  /** Every registered event definition (fnd-T16). */
  readonly events: readonly EventDefinitionRef[];
  /** Every registered event subscription (fnd-T17). */
  readonly subscriptions: readonly EventSubscriptionRef[];
  /** Every declared cross-module `ctx.call` edge (module specs, ADR-0015). */
  readonly callEdges: readonly DeclaredCallEdge[];
  /** Projection grants declared by projection owners (fnd-T5A manifest). */
  readonly projectionGrants: ProjectionGrantLookup;
  /** Read-model grants declared in owning specs (ADR-0015 §3). */
  readonly readModelGrants: readonly ReadModelGrantRef[];
  /** Actual module → schema import edges (ADR-0014 ownership map). */
  readonly schemaImports: readonly SchemaImportRef[];
}

export interface ContractCheckResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

/** Walks the registry and manifests; returns every violation found. */
export function runContractCheck(
  input: ContractCheckInput,
): ContractCheckResult {
  const problems: string[] = [];
  const contracts = input.registry.contracts();
  const contractsByName = new Map(
    contracts.map((contract) => [contract.name, contract]),
  );

  collectPairingProblems(input.registry, problems);
  const eventsByName = collectEventDefinitionProblems(input.events, problems);
  for (const contract of contracts) {
    collectProjectionGrantProblems(contract, input.projectionGrants, problems);
    collectEmitProblems(contract, eventsByName, problems);
  }
  collectSubscriptionProblems(
    input.subscriptions,
    eventsByName,
    contractsByName,
    problems,
  );
  collectCallEdgeProblems(input.callEdges, contractsByName, problems);
  collectAtomicEdgeProblems(contracts, contractsByName, problems);
  collectSchemaOwnershipProblems(
    input.readModelGrants,
    input.schemaImports,
    problems,
  );

  return { ok: problems.length === 0, problems };
}

/** Like `runContractCheck`, but throws `ContractCheckError` on violations. */
export function assertContractCheck(input: ContractCheckInput): void {
  const result = runContractCheck(input);
  if (!result.ok) {
    throw new ContractCheckError(result.problems);
  }
}

/**
 * Pairing (ADR-0016) is owned by the registry; re-raised here as collected
 * problems so one CI report covers orphans alongside the manifest rules.
 */
function collectPairingProblems(
  registry: ActionRegistry,
  problems: string[],
): void {
  try {
    registry.assertPaired();
  } catch (error) {
    if (!(error instanceof ActionRegistryError)) {
      throw error;
    }
    problems.push(...error.problems);
  }
}

function collectEventDefinitionProblems(
  events: readonly EventDefinitionRef[],
  problems: string[],
): Map<string, EventDefinitionRef> {
  const eventsByName = new Map<string, EventDefinitionRef>();
  for (const event of events) {
    if (eventsByName.has(event.name)) {
      problems.push(
        `event "${event.name}": duplicate definition — exactly one module defines each event (core.md §6)`,
      );
      continue;
    }
    eventsByName.set(event.name, event);
  }
  return eventsByName;
}

function collectProjectionGrantProblems(
  contract: ActionContract,
  projectionGrants: ProjectionGrantLookup,
  problems: string[],
): void {
  if (
    contract.publicScope === "globalProjection" &&
    contract.projectionGrant !== undefined &&
    !projectionGrants.has(contract.projectionGrant)
  ) {
    problems.push(
      `action "${contract.name}": projectionGrant "${contract.projectionGrant}" is not declared by any projection owner (core.md §2, ADR-0020)`,
    );
  }
}

/**
 * The event scope an action's emissions must declare, derived from the
 * emitter's own scope (core.md §6 envelope):
 *
 * - staff, customer, and system-tenant actions carry a verified
 *   `companyId`, so their events are tenant events;
 * - global system actions carry no company, so their events are global;
 * - account actions emit with a null `companyId` (§6: "null for declared
 *   global system events and account-principal events"), and a
 *   tenant-scope event without `companyId` is rejected at emit time — so
 *   account-declared events must be `scope: "global"`.
 *
 * Public and consumer actions cannot emit at all (define-time rule), so no
 * scope applies.
 */
function emitterEventScope(
  contract: ActionContract,
): "tenant" | "global" | undefined {
  switch (contract.principal) {
    case "staff":
    case "customer":
      return "tenant";
    case "system":
      return contract.systemScope;
    case "account":
      return "global";
    default:
      return undefined;
  }
}

function collectEmitProblems(
  contract: ActionContract,
  eventsByName: ReadonlyMap<string, EventDefinitionRef>,
  problems: string[],
): void {
  const requiredScope = emitterEventScope(contract);
  for (const name of contract.emits) {
    const definition = eventsByName.get(name);
    if (definition === undefined) {
      problems.push(
        `action "${contract.name}": emits "${name}" but no event definition is registered (core.md §2/§6)`,
      );
      continue;
    }
    if (requiredScope !== undefined && definition.scope !== requiredScope) {
      problems.push(
        `action "${contract.name}": emits "${name}" with scope "${definition.scope}", but ${describeEmitter(contract)} requires scope "${requiredScope}" (core.md §6)`,
      );
    }
  }
}

function describeEmitter(contract: ActionContract): string {
  if (contract.principal === "system") {
    return `a system (${contract.systemScope ?? "unknown"}-scope) emitter`;
  }
  const article = contract.principal === "account" ? "an" : "a";
  return `${article} ${contract.principal} emitter`;
}

function collectSubscriptionProblems(
  subscriptions: readonly EventSubscriptionRef[],
  eventsByName: ReadonlyMap<string, EventDefinitionRef>,
  contractsByName: ReadonlyMap<string, ActionContract>,
  problems: string[],
): void {
  const seenBindings = new Set<string>();
  for (const subscription of subscriptions) {
    const label = `subscription "${subscription.consumer}" of "${subscription.event}"`;
    const bindingKey = `${subscription.consumer}\u0000${subscription.event}`;
    if (seenBindings.has(bindingKey)) {
      problems.push(
        `${label}: duplicate binding — consumer dedup is keyed on (consumer, eventId), so one consumer binds each event once (core.md §6)`,
      );
    }
    seenBindings.add(bindingKey);

    const event = eventsByName.get(subscription.event);
    if (event === undefined) {
      problems.push(`${label}: the event has no registered definition`);
    }

    const target = contractsByName.get(subscription.action);
    if (target === undefined) {
      problems.push(
        `${label}: bound action "${subscription.action}" is not registered`,
      );
      continue;
    }
    // The §6 binding contract: transport-internal, AI-internal,
    // system-principal, write, idempotent. Each property gets its own
    // problem so a wrong binding is diagnosed in one run.
    if (target.principal !== "system") {
      problems.push(
        `${label}: bound action "${target.name}" must be system-principal (core.md §6)`,
      );
    }
    if (target.transport !== "internal") {
      problems.push(
        `${label}: bound action "${target.name}" must be transport-internal (core.md §6)`,
      );
    }
    if (target.aiExposure !== "internal") {
      problems.push(
        `${label}: bound action "${target.name}" must be AI-internal (core.md §6)`,
      );
    }
    if (target.risk !== "write") {
      problems.push(
        `${label}: bound action "${target.name}" must declare risk: "write" (core.md §6)`,
      );
    }
    if (!target.idempotent) {
      problems.push(
        `${label}: bound action "${target.name}" must be idempotent — deliveries are at-least-once (core.md §6)`,
      );
    }
    if (
      event !== undefined &&
      target.principal === "system" &&
      target.systemScope !== event.scope
    ) {
      problems.push(
        `${label}: bound action "${target.name}" has systemScope "${target.systemScope ?? "unknown"}" but the event is ${event.scope}-scoped — core invokes the consumer with a system context matching the event's company scope (core.md §6)`,
      );
    }
  }
}

function collectCallEdgeProblems(
  callEdges: readonly DeclaredCallEdge[],
  contractsByName: ReadonlyMap<string, ActionContract>,
  problems: string[],
): void {
  for (const edge of callEdges) {
    const label = `ctx.call edge "${edge.caller}" → "${edge.callee}"`;
    const caller = contractsByName.get(edge.caller);
    const callee = contractsByName.get(edge.callee);
    if (caller === undefined) {
      problems.push(`${label}: caller is not registered`);
    }
    if (callee === undefined) {
      problems.push(`${label}: callee is not registered`);
    }
    if (caller === undefined || callee === undefined) {
      continue;
    }
    // The per-target rules are shared with the fnd-T19 runtime assert
    // (call-rules.ts) so this CI layer and `ctx.call` cannot drift.
    for (const problem of callTargetProblems(caller, callee)) {
      problems.push(`${label}: ${problem}`);
    }
  }
}

/**
 * ADR-0021: atomic edges are valid only when both descriptors declare
 * them. Callee shape (internal, write, no confirmation) and root shape
 * (writable, idempotent) are define-time rules; existence, mutuality, and
 * principal compatibility need the whole registry and live here.
 */
function collectAtomicEdgeProblems(
  contracts: readonly ActionContract[],
  contractsByName: ReadonlyMap<string, ActionContract>,
  problems: string[],
): void {
  for (const contract of contracts) {
    for (const calleeName of contract.atomicCalls) {
      const label = `atomic edge "${contract.name}" → "${calleeName}"`;
      const callee = contractsByName.get(calleeName);
      if (callee === undefined) {
        problems.push(`${label}: callee is not registered`);
        continue;
      }
      if (!callee.atomicCallers.includes(contract.name)) {
        problems.push(
          `${label}: not mutually declared — "${calleeName}" does not list "${contract.name}" in atomicCallers (ADR-0021)`,
        );
      }
      if (!atomicPrincipalCompatible(contract, callee)) {
        problems.push(
          `${label}: caller (${describePrincipal(contract)}) and callee (${describePrincipal(callee)}) must use the same principal mode (ADR-0021)`,
        );
      }
    }
    for (const callerName of contract.atomicCallers) {
      const label = `atomic edge "${callerName}" → "${contract.name}"`;
      const caller = contractsByName.get(callerName);
      if (caller === undefined) {
        problems.push(`${label}: declared caller is not registered`);
        continue;
      }
      if (!caller.atomicCalls.includes(contract.name)) {
        problems.push(
          `${label}: not mutually declared — "${callerName}" does not list "${contract.name}" in atomicCalls (ADR-0021)`,
        );
      }
      // Principal compatibility is reported once, from the caller side.
    }
  }
}

/**
 * ADR-0021 requires the same principal mode and verified company scope on
 * both sides of an atomic edge; company equality is a runtime concern, but
 * mode (and, for system pairs, declared scope) is static.
 */
function atomicPrincipalCompatible(
  caller: ActionContract,
  callee: ActionContract,
): boolean {
  if (caller.principal !== callee.principal) {
    return false;
  }
  if (caller.principal === "system") {
    return caller.systemScope === callee.systemScope;
  }
  return true;
}

/** The only modules ADR-0015 §3 grants cross-module read-model access. */
const PROJECTION_MODULES: ReadonlySet<string> = new Set([
  "search",
  "analytics",
]);

function collectSchemaOwnershipProblems(
  readModelGrants: readonly ReadModelGrantRef[],
  schemaImports: readonly SchemaImportRef[],
  problems: string[],
): void {
  for (const grant of readModelGrants) {
    if (!PROJECTION_MODULES.has(grant.grantee)) {
      problems.push(
        `read-model grant "${grant.owner}" → "${grant.grantee}": grantee is not a cross-cutting projection module (ADR-0015 §3 names search and analytics only)`,
      );
    }
  }
  for (const schemaImport of schemaImports) {
    if (schemaImport.importer === schemaImport.schemaOwner) {
      continue;
    }
    const granted = readModelGrants.some(
      (grant) =>
        grant.owner === schemaImport.schemaOwner &&
        grant.grantee === schemaImport.importer,
    );
    if (!granted) {
      problems.push(
        `module "${schemaImport.importer}" imports the "${schemaImport.schemaOwner}" schema without a read-model grant declared in the owning spec (ADR-0014, ADR-0015)`,
      );
    }
  }
}
