# @showzy/core — Agent Instructions

The action runtime (core.md). **Frozen for module tasks** (prohibitions.mdc):
module implementation tasks may not change anything here — if core is missing
something, stop and report.

## Current state (fnd-T11)

Three export subpaths exist:

- `@showzy/core/contract` — the client-safe leaf (fnd-T8, below).
- `@showzy/core/errors` — the ten core.md §11 error classes.
- `@showzy/core` (root, server-only) — `implementAction` + `ActionRegistry`
  (fnd-T9), the registry-walking contract check (fnd-T10), and the six
  principal context factories + `effectiveCompanyId` +
  `staffHasPermission` (fnd-T11).

The rest of the runtime — execution pipeline, events, idempotency,
confirmation, rate limiting, `ctx.call`/`ctx.callAtomic`, and the module
test kit — lands with fnd-T12…T22.

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
- `types.ts` — callback shapes. Return types are spec commitments;
  `ActionExecutionCtx` (= `ActionCtx`) and `TargetResolutionEnv`
  (`{ tx: ReadTx, principal, inheritedCompanyId? }`) were narrowed by
  fnd-T11; the summary/audit environments remain opaque aliases owned by
  fnd-T13/T20 — narrow the alias there, do not commit internals early.

## Principal contexts (`src/runtime/context/`, core.md §3)

- `types.ts` — the six-mode `ActionCtx` discriminated union. The DB slot
  is the capability the action's `risk` allows (`Tx`, `ReadTx`, or a
  grant-bound `ProjectionReadTx`); `emit`/`call`/`callAtomic` are opaque
  slots narrowed by fnd-T16/T19/T19A; `deadline`/`signal` values are
  supplied by the pipeline (fnd-T12) through `ContextRuntime`.
- `factories.ts` — exactly one factory per mode, the only construction
  path (never assemble a context by hand): staff verifies the
  `x-company-id` selector against a `company_members` row (the selector is
  never authority; missing/foreign/nonexistent all deny with one message);
  customer/public-target run the typed resolver over a read-only facade
  and adopt its resolved company; public-global binds the declared
  projection grant; system takes an explicit tenant/global scope from the
  enqueuing code; consumer/account require a session and carry no company
  scope at all. Factories bind the pino child logger
  (request/actor/company/action, snake_case — security-operations §6) and
  `effectiveCompanyId(ctx)` is the one resolved-scope helper.
- `permissions.ts` — precedence in one place: owner-all, deny wins,
  grant, role default (companies-foundation.md §2). Check permissions only
  through `staffHasPermission`; never read `membership.permissions`
  directly (it cannot represent owner-all).
- Integration tests live in `*.db.test.ts` files — the vitest `db` project
  boots the shared Testcontainers harness (`@showzy/db/testing`); plain
  `*.test.ts` files stay in the Docker-free `unit` project that the CI
  contract-check stage runs.

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
- The package `tsconfig.json` carries `"types": ["node"]` for the
  server-only runtime; `tsconfig.contract.json` re-checks `src/contract`
  with `"types": []` in the same `typecheck` script, so an accidental
  `process`/`Buffer` reference in the leaf is still a compile error.
- Every better place for server-only concerns exists: put nothing in
  `contract` that a mobile bundle must not ship.
