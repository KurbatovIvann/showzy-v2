# @showzy/core — Agent Instructions

The action runtime (core.md). **Frozen for module tasks** (prohibitions.mdc):
module implementation tasks may not change anything here — if core is missing
something, stop and report.

## Current state (fnd-T8)

Only the client-safe `contract` subpath exists. The runtime — typed errors,
registry, `implementAction`, principal contexts, execution pipeline, events,
idempotency, confirmation, rate limiting, `ctx.call`/`ctx.callAtomic`, and
the module test kit — lands with fnd-T9…T22. Do not import `@showzy/core`
root; it has no export yet.

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
