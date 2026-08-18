# @showzy/contract — Agent Instructions

The boundary between action definitions and every consumer (contract.md,
ADR-0004, ADR-0016). Derives the oRPC contract router, the wire-error table,
and the AI tool-manifest source from client-safe action descriptors; the
`./server` subpath pairs those procedures with registered implementations
through the core execution pipeline. **Owns no domain logic and no state.**

## Current state (fnd-T23)

Two export subpaths:

- `@showzy/contract` (root, client-safe) — `buildContractRouter` /
  `contractRouter` from the exposure record, the contract.md §4
  `wireErrorStatus` / `wireErrorDefinitions` table, transport-meta header
  names, and `deriveAiToolSources` / `aiToolSourcesForPrincipal`.
- `@showzy/contract/server` — `buildServerRouter` (every procedure is
  `executeAction`), `toPipelineRequestMeta` / `toPrincipalInvocation`,
  `toWireError` + `wireErrorInterceptors`. Reaches the core runtime; the
  CI bundle probe (fnd-T25) must reject this subpath from client entries.

No domain modules exist yet, so `contractModules` is explicitly empty.
Module tasks add their `index.contract.ts` barrels there. The typed client
(`createMutationAttempt`, money wire helpers) is fnd-T24; ESLint
boundaries, the bundle probe, and OpenAPI drift are fnd-T25.

## Client-safe root (`src/client/`)

- Import graph may reach **Zod**, `@orpc/contract`, and
  `@showzy/core/contract` (plus a type-only pin to `@showzy/core/errors`
  so the wire table cannot drift from the §11 vocabulary). No core
  runtime, `packages/db`, Node builtins, logging, Redis, or workers.
- `tsconfig.client.json` re-checks `src/client` with `"types": []` in the
  same `typecheck` script — an accidental `process`/`Buffer` reference is
  a compile error.
- Only `transport: "client"` descriptors are routable.
  `buildContractRouter` / `buildServerRouter` **fail loudly** on an
  internal/system entry rather than filtering it out — silent omission
  would hide a composition bug.
- Record keys must mirror `<module>.<verb>` exactly: the RPC path is the
  nested object shape, so a mismatch would serve one action under
  another's name.

## Server subpath (`src/server/`)

- `apps/api` (fnd-T26) resolves the session, trusted-proxy IP, and meta
  headers into `TransportInvocationContext`. This package maps that onto
  pipeline shapes; it never treats a selector as authority (ADR-0013).
- `toPrincipalInvocation` is the one place each mode is allowed to see
  transport meta: staff gets the raw selector (core verifies membership);
  customer/consumer/account get only the session; public gets nothing;
  system is unreachable (composition error).
- Every procedure runs `executeAction`. There is no second data path.
  Pairing problems (orphans, descriptor drift, a registered client action
  missing from the exposure record) fail boot.
- `toWireError` maps the ten §11 classes onto the §4 table (`clientMessage`
  only; `INTERNAL` carries no details). `wireErrorInterceptors` remaps
  oRPC's own `BAD_REQUEST` / output-validation failures onto the same
  vocabulary — mount them as `clientInterceptors` on `RPCHandler`.

## Adding a module's client actions

1. Export descriptors from the module's `index.contract.ts`.
2. Add them to `src/client/modules.ts` under `{ [module]: { [verb]: contract } }`
   with keys that match `contract.name`.
3. Register both barrels in the API boot registry (fnd-T26). The server
   router builder proves the exposure record and the registry agree.

Do not hand-write oRPC procedures, wire codes, or AI-tool lists — they
all derive from the descriptor.

## Testing

- `*.test.ts` — Docker-free: the §4 table, composition rules, AI coverage,
  wire mapping, principal dispatch of transport meta.
- `*.db.test.ts` — transport round-trip against the Testcontainers
  harness (`@showzy/core/testing`): every §4 error class over the wire,
  selector/session rules, idempotency and confirmation meta, orphan boot
  failure. Docker required.
