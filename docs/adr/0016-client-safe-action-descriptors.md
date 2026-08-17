# ADR-0016: Client-safe action descriptors and server implementations

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: owner

## Context

ADR-0008 requires one logical action definition to generate oRPC, OpenAPI,
forms, and AI tools while executing one server handler. A literal object that
contains both Zod schemas and a DB-aware handler cannot be imported by Expo:
Node/Drizzle dependencies can leak into the mobile bundle. Copying schemas
would recreate contract drift.

The dependency direction must also avoid `modules → packages/contract →
modules`.

## Decision

One logical action has two physically separate files:

1. `actions/<name>.contract.ts` defines all serializable metadata and Zod
   input/output through `defineActionContract` from the client-safe
   `@showzy/core/contract` export.
2. `actions/<name>.ts` binds exactly one implementation through
   `implementAction(contract, serverCallbacks)`.

`@showzy/core/contract` is a leaf export graph: it may depend only on Zod and
client-safe validation/types. It cannot import the core runtime, DB, Node
builtins, logging, Redis, or workers.

Dependency direction:

```text
validation ───────────────┐
@showzy/core/contract ────┼→ module *.contract.ts
                          └→ packages/contract → mobile/web

module *.contract.ts → module server implementation
packages/db + core runtime ──────────────────────────┘

module server implementations + packages/contract → apps/api
core runtime + module consumer actions             → apps/worker
```

`packages/contract` imports only each module's exported
`index.contract.ts` subpath. Module server code never imports
`packages/contract`, so there is no cycle. Mobile/web import only generated
client artifacts from `packages/contract`, never a module root.

The build produces separate artifacts:

- client/oRPC/OpenAPI from `transport: client` descriptors;
- AI manifest from `transport: client` + `aiExposure: exposed`;
- server registry from all descriptor/implementation pairs.

System/internal actions have no client/OpenAPI/AI route.

## Enforcement

- package `exports` expose explicit client/server subpaths;
- ESLint boundaries reject forbidden descriptor imports;
- CI bundle probe fails on Node builtins, DB, server core, or module server
  code reachable from the generated client;
- contract check fails on duplicate names, orphan descriptors,
  implementations without descriptors, and invalid transport exposure;
- API boot fails if any registered descriptor/implementation pair is
  incomplete.

## Alternatives considered

- **One object containing handler and schemas** — rejected: unsafe client
  transitive imports.
- **Schemas copied into `packages/contract`** — rejected: destroys the single
  source of truth.
- **Descriptors defined in `packages/contract`** — rejected: creates a
  package cycle when that package aggregates module contracts.
- **A new standalone action-contract package** — viable, but unnecessary
  while the audited `@showzy/core/contract` leaf export remains enforceable.

## Consequences

- ADR-0008's “one definition” means one logical paired capability, not one
  physical file.
- Module conventions require `index.ts` (server actions/events) and
  `index.contract.ts` (client-safe descriptors).
- The bundle probe is a phase-0 scaffold gate, not a later optimization.
- Any unavoidable dependency from `@showzy/core/contract` to server code
  requires a new ADR; agents may not work around the boundary.
