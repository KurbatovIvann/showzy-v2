# Spec: packages/contract

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Written against blueprint §3, §4; ADR-0004, ADR-0008, ADR-0013, and
> ADR-0016.
> Foundation spec. Resolves the client-safety question: how one action
> definition feeds server, mobile, web, AI, and OpenAPI without leaking
> Node/DB dependencies into client bundles.

## 1. Purpose

`packages/contract` is the boundary between action definitions and every
consumer. It derives from the registry: the oRPC router (server), the typed
client (Expo/Next.js), the OpenAPI document, and the AI tool manifest
source. It owns no logic and no state.

## 2. Client safety — the two-layer split

The problem (foundation review P0-2): `defineAction` includes a handler
that imports Drizzle/Node; Expo must never bundle that.

The split:

- **Layer 1 — contract descriptors (client-safe).** Every module's
  `actions/<name>.ts` is split in two files by convention, enforced by
  ESLint boundaries:
  - `actions/<name>.contract.ts` —
    `defineActionContract({...})` imported from the explicitly client-safe
    `@showzy/core/contract` subpath: all §2 metadata from core.md **except**
    `handler`, `resolveTarget`, `confirmationSummary`, `auditTarget`,
    `auditSnapshot`, and other server callbacks. Imports allowed: Zod,
    `@showzy/core/contract`, shared
    validation schemas (`packages/validation`), nothing else. The
    `@showzy/core/contract` export graph contains no DB/Node/runtime imports.
  - `actions/<name>.ts` — `implementAction(contract, { resolveTarget?,
    confirmationSummary?, auditTarget?, auditSnapshot?, handler })`: binds
    the server-only parts. May
    import Drizzle, services, schema.
- **Layer 2 — composition.**
  - `packages/contract` imports **only** `*.contract.ts` files (via each
    module's `index.contract.ts` barrel). It retains all descriptors for
    pairing/CI, but builds the oRPC client contract, OpenAPI document, and
    typed client only from `transport: client` actions. `system` and other
    internal actions have no externally mountable route.
  - `apps/api` imports the full modules (contracts + implementations),
    registers them in the core registry, and mounts the oRPC router that
    pairs each contract procedure with its handler through the core
    execution pipeline (core.md §4). A contract without an implementation
    (or vice versa) fails at boot and in the contract check.
- AI manifests include only descriptors with both `transport: client` and
  `aiExposure: exposed`, then filter by current principal/permissions. AI is
  not a bypass to an internal action.

Enforcement (CI):

- ESLint boundaries: `*.contract.ts` may import only Zod,
  `@showzy/core/contract`, and validation;
  `packages/contract` may import only `*.contract.ts`; client apps may
  import only `packages/contract` (+ validation/ui).
- A **bundle probe**: CI builds a minimal client entry that imports the full
  typed client with a bundler configured to fail on Node builtins /
  `packages/db` / `packages/core` server paths (the client-safe
  `@showzy/core/contract` subpath is allowed). Red = someone leaked a server
  import into the contract layer.

## 3. Transport and auth

- oRPC over HTTP mounted in Hono at `/rpc`; OpenAPI-shaped REST aliases are
  generated at `/api/v1` for external consumers (webhooks docs, future
  public API).
- Auth: better-auth session — cookie on web, bearer token on Expo. The
  contract client factory accepts a token provider; apps/api resolves the
  session and hands it to the core principal factories (core.md §3). The
  contract layer itself never interprets permissions — that is core's job.
- Staff company selection: the active `companyId` travels as a dedicated
  header (`x-company-id`) that core verifies against membership — it is a
  *selector*, never an access grant (ADR-0013).
- Idempotency keys travel as `idempotency-key` header / oRPC meta
  (core.md §5). The generated client exposes `createMutationAttempt()`,
  which creates one key and reuses it for every retry of that logical
  submit; the server rejects a missing key for idempotent mutations.
  `requiresConfirmation` challenges return as a typed error and are supplied
  on re-invocation as transport meta, never added to action input (core.md
  §7, so the input hash stays stable).
- Money minor units cross the wire as canonical base-10 strings and are
  mapped explicitly to/from domain `bigint` at action/client boundaries;
  action Zod input/output remains JSON-safe and never transforms a wire value
  into `bigint` inside the transport contract (db.md §3).

## 4. Error mapping

Typed core errors (core.md §11) map to stable wire codes:

| Core error | HTTP | Wire code |
| --- | --- | --- |
| ValidationError | 400 | `VALIDATION` (+ Zod issues) |
| PermissionDeniedError | 403 | `PERMISSION_DENIED` |
| NotFoundError | 404 | `NOT_FOUND` |
| ConflictError / IdempotencyConflictError | 409 | `CONFLICT` / `IDEMPOTENCY_CONFLICT` |
| ConcurrentRetryError | 409 | `RETRY_IN_PROGRESS` (+ retryAfter) |
| ConfirmationRequiredError | 409 | `CONFIRMATION_REQUIRED` (+ challenge) |
| RateLimitError | 429 | `RATE_LIMITED` (+ retryAfter) |
| TimeoutError | 504 | `TIMEOUT` |
| CoreInvariantError / unknown | 500 | `INTERNAL` (no details on the wire) |

Clients get a discriminated union typed by wire code — no string matching.

## 5. OpenAPI

Generated from the contract layer in CI and committed as an artifact
(`packages/contract/openapi.json`); drift check like migrations. Action
`description` doubles as the OpenAPI summary — one more reason it is
written carefully (it also becomes the AI tool description).

## 6. Versioning policy

MVP: single version, additive evolution only (new optional fields, new
actions). Breaking a shipped action's input/output requires a new action
name (`orders.createV2`) — cheap in the registry model — and a deprecation
note in the spec. Full URL versioning deferred until there are external
API consumers.

## 7. Acceptance criteria

- [ ] Expo test app imports the typed client; bundle probe passes; type
      errors surface at `tsc` when an action contract changes.
- [ ] Importing `@showzy/core/contract` from the bundle probe reaches no
      server/runtime/DB module.
- [ ] Contract/implementation pairing: missing handler or orphan
      implementation fails boot + contract check (tests).
- [ ] `transport: internal` and every system action are absent from client,
      OpenAPI, and AI artifacts and return no routable endpoint.
- [ ] Error mapping table covered by integration tests per error class.
- [ ] `x-company-id` for a company without membership → 403 (test).
- [ ] Missing idempotency meta on an idempotent mutation → typed validation
      error; automatic network retry reuses the original key.
- [ ] Confirmation challenge meta is not part of action input and cannot
      change the canonical request hash.
- [ ] OpenAPI drift check red on uncommitted contract changes.
- [ ] `*.contract.ts` importing `packages/db` → ESLint error (test).

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Defined the client-safe core subpath, retry-key ownership, confirmation transport, and bigint wire encoding | Foundation consistency review against core/db specs and ADR-0013 | GPT-5.6 Sol |
| 2026-08-17 | Initial draft | — | spec agent (Fable 5) |
