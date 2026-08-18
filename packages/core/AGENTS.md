# @showzy/core — Agent Instructions

The action runtime (core.md). **Frozen for module tasks** (prohibitions.mdc):
module implementation tasks may not change anything here — if core is missing
something, stop and report.

## Current state (fnd-T10)

Three export subpaths exist:

- `@showzy/core/contract` — the client-safe leaf (fnd-T8, below).
- `@showzy/core/errors` — the ten core.md §11 error classes.
- `@showzy/core` (root, server-only) — `implementAction` + `ActionRegistry`
  (fnd-T9) + the registry-walking contract check (fnd-T10).

The rest of the runtime — principal contexts, execution pipeline, events,
idempotency, confirmation, rate limiting, `ctx.call`/`ctx.callAtomic`, and
the module test kit — lands with fnd-T11…T22.

## Typed errors (`src/errors/`, core.md §11)

- Ten classes on the `CoreError` base; the only error vocabulary for
  domain code. Never `throw new Error("...")` in handlers/services.
- `code` values are pinned to the contract.md §4 wire table by a test —
  renaming one is a breaking client API change and goes through spec
  rework.
- `clientMessage` is the only free-text string the contract layer may
  serialize; `Error#message` is log-facing and carries `internalMessage`
  diagnostics (IDs, tenant scope) that must never reach a client.
  `CoreInvariantError` takes an internal description only — its client
  message is a fixed generic string.

## Runtime (`src/runtime/`, ADR-0016)

- `implement-action.ts` — `implementAction(contract, callbacks)` validates
  at implement time that exactly the callbacks the metadata implies are
  bound (`resolveTarget` iff customer/public-target, `confirmationSummary`
  iff `requiresConfirmation`, `auditTarget`/optional `auditSnapshot` iff
  `audit: true`), throws `ActionImplementationError` listing all problems,
  freezes and brands the pair.
- `action-registry.ts` — `ActionRegistry` with duplicate detection on both
  contracts and implementations; `assertPaired()` is the boot gate: orphan
  descriptors, orphan implementations, and same-name-different-object
  drift (a redefined descriptor) all fail before anything serves traffic.
- `types.ts` — callback shapes. Return types are spec commitments; the
  environment parameters (`ActionExecutionCtx`, resolver/summary/audit
  envs) are opaque aliases owned by fnd-T11/T12/T13/T20 — narrow the
  alias there, do not commit context internals here.

## The contract check (`src/contract-check/`, core.md §2)

The CI gate is layered — all three layers run in the `contract-check` CI
stage (`pnpm --filter @showzy/core contract:check`):

1. **Define time** — `defineActionContract` throws on every single-descriptor
   rule when the stage imports a module barrel.
2. **Implement/registration time** — `implementAction` (conditional
   callbacks), `ActionRegistry` (duplicates, `assertPaired`).
3. **Registry-wide** — `runContractCheck(input)` aggregates every violation
   that needs the whole registry plus the manifests: unknown projection
   grants, event definition existence/duplicates, emitter/event scope
   consistency (account and global-system emitters declare `scope: "global"`
   events — their envelopes carry a null company), subscription binding
   rules (system/internal/AI-internal/write/idempotent + scope match),
   declared `ctx.call` edge rules (cross-module, `risk: read`,
   principal-compatible, no public-global on either side), atomic-edge
   mutuality/compatibility (ADR-0021), and the ADR-0015 schema-ownership
   manifest (foreign schema imports need an owner-declared read-model grant
   to `search`/`analytics`).

`registered-modules.ts` is the interim composition manifest the stage walks
(`ci-stage.test.ts`). Everything is explicitly empty until modules exist;
event definitions/subscriptions arrive with fnd-T16/T17, and fnd-T23/T26
move composition to `packages/contract` / apps boot. `EventDefinitionRef`,
`EventSubscriptionRef`, and the other input shapes are structural on purpose
so fnd-T16/T17 outputs satisfy them without core changes.

## The `contract` subpath (ADR-0016)

- `src/contract/types.ts` — serializable metadata types (core.md §2):
  principal/transport/risk unions, `publicScope`, `projectionGrant`,
  `systemScope`, `atomicCalls`/`atomicCallers`, rate-limit override, and the
  `ActionContractDefinition`/`ActionContract` shapes. Server callbacks
  (`handler`, `resolveTarget`, `confirmationSummary`, `auditTarget`,
  `auditSnapshot`) are deliberately absent — `implementAction` (fnd-T9)
  binds them server-side.
- `src/contract/define-action-contract.ts` — `defineActionContract`:
  validates every rule checkable from one descriptor in isolation, throws
  `ActionContractDefinitionError` listing **all** violations, freezes and
  brands the result. Registry-wide rules (duplicate names, event
  definitions, mutual atomic edges, grant existence) belong to the contract
  check (fnd-T10) — do not duplicate them here.
- The input type is deliberately permissive about cross-field combinations;
  runtime define-time validation is the authority. This keeps rejection
  paths testable without `@ts-expect-error` and produces precise messages
  instead of opaque compile errors.

## Client-safety rules

- The `contract` export graph may import **only Zod** (and, later, shared
  validation schemas). No core runtime, `packages/db`, Node builtins,
  logging, Redis, or workers — the CI bundle probe (fnd-T25) fails on leaks.
- `tsconfig.json` sets `"types": []` so an accidental `process`/`Buffer`
  reference is a compile error. Runtime subpaths that need Node types must
  arrange their own config without widening the contract leaf.
- Every better place for server-only concerns exists: put nothing in
  `contract` that a mobile bundle must not ship.
