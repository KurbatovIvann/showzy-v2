# Spec: packages/core

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Written against blueprint §2.1, §4, §7; ADR-0008, ADR-0009, ADR-0011,
> ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0016, and ADR-0018.
> This is a foundation spec: it defines executable protocols, not a domain
> module. It owns no domain tables; the foundation tables it drives
> (`domain_events`, `event_aggregate_sequences`, `event_deliveries`,
> `idempotency_keys`, `audit_log`)
> are specified in `docs/specs/db.md` and are off-limits to module tasks.

## 1. Purpose

`packages/core` provides the client-safe `defineActionContract` leaf export
and the server-only `implementAction` runtime/registry (ADR-0016),
principal contexts, permission evaluation, the execution pipeline
(validation → authorization → idempotency → transaction → outbox → audit),
`ctx.call`, `ctx.emit`, the event bus with consumer registration, the
confirmation protocol for `requiresConfirmation` actions, typed errors, rate
limiting, and the module test kit every module inherits. It explicitly does
NOT own: HTTP transport (apps/api + packages/contract), queues for execution
jobs (BullMQ in apps/worker), any domain logic, any domain tables.

## 2. The action contract

One logical action is a client-safe descriptor paired with exactly one server
implementation. Serializable rows below belong to `defineActionContract`;
callback rows (`resolveTarget`, confirmation/audit callbacks, `handler`) are
bound by `implementAction`. All fields are required unless noted:

| Field | Type / values | Notes |
| --- | --- | --- |
| `name` | `<module>.<verb>` | Unique in the registry; CI fails on duplicates |
| `description` | string | Written as an instruction to an AI model |
| `principal` | `staff` \| `customer` \| `public` \| `system` \| `consumer` | ADR-0013, ADR-0018; exactly one; public and consumer actions are read-only |
| `transport` | `client` \| `internal` | Whether HTTP/client routers mount it; `system` must be internal |
| `input` / `output` | Zod v4 schemas | The single source for oRPC, forms, AI tools |
| `permissions` | `string[]` of `<module>:<verb>` | Non-empty for `staff`; must be `[]` for `customer`/`public`/`consumer` (authorization = ownership/visibility/published-read, §4); must be `[]` for `system` |
| `resolveTarget` | typed fn, **customer/public only** | `<TTarget>(input, { tx, principal }) => Promise<{ companyId, resource: TTarget }>` — customer args include authenticated `userId`; a nested `ctx.call` also supplies the already verified `inheritedCompanyId`. Loads the referenced resource and proves ownership/visibility; throws `NotFoundError` (never "forbidden" — no existence leaks). Not applicable to `consumer` (no company scope) |
| `systemScope` | `tenant` \| `global`, **system only** | Tenant-scoped system actions require `ctx.companyId`; `global` is reserved for genuinely global jobs |
| `aiExposure` | `exposed` \| `internal` | `exposed` requires `transport: client`; `internal` never becomes an AI tool |
| `risk` | `read` \| `draft` \| `write` \| `high` | `read` handlers/resolvers receive a `ReadTx` capability; top-level reads also use a DB read-only transaction |
| `requiresConfirmation` | boolean | Required for human-invoked `risk: high`; triggers the confirmation protocol (§7) |
| `confirmationSummary` | server fn, conditional | Required when `requiresConfirmation: true`; returns a redacted, human-readable summary from validated input + resolved target |
| `idempotent` | boolean | Write actions with `true` participate in the idempotency protocol (§5) |
| `emits` | `string[]` event names | Declared outbox events; `ctx.emit` of an undeclared event throws; CI checks declared events have a definition |
| `audit` | boolean | §8. Mandatory `true` for `risk: write`/`high` |
| `auditTarget` | server fn, conditional | Required when `audit: true`; derives `{ type, id }` from validated input/output/context |
| `auditSnapshot` | optional server fn | Returns explicitly redacted safe JSON; hash-only is the default |
| `timeout` | ms | Whole-pipeline deadline, shared with nested `ctx.call`s; DB statement timeout and abort signal enforce it |
| `rateLimit` | optional `{ limit, windowSec, scope }` | Defaults per principal (§10) |
| `handler` | `(input, ctx) => Promise<TOutput>` | Runs inside the transaction; output is Zod-validated before commit and must be JSON-safe |

The **contract check** (CI, phase-0 task) walks the registry and fails on:
missing/empty metadata, duplicate names, invalid transport/principal/AI
combinations, `customer`/`public` actions with
permissions, `customer`/`public` actions without `resolveTarget`, `consumer`
actions with `resolveTarget`, `consumer` actions not satisfying
(`risk: read`, `permissions: []`, `audit: false`, `idempotent: false`,
`requiresConfirmation: false`, `emits: []`, `transport: client`), invalid
`systemScope`, invalid confirmation metadata (`requiresConfirmation` implies
human principal + `risk: high` + `idempotent: true`), `emits` naming violations
(`<module>.<pastVerb>`), undeclared event definitions, `ctx.call` targets
that are not `risk: read` or do not accept the caller's principal,
event scope inconsistent with action/system scope, `risk: write|high` with
`audit: false`, `audit: true` without `auditTarget`, event subscriptions not
bound to a compatible internal idempotent system action. The same CI phase
validates the schema-ownership
manifest: every foreign schema import by `search`/`analytics` must match a
read-model grant declared in the owning spec (ADR-0015).

Public actions are a strict subset: `risk: read`, `audit: false`,
`idempotent: false`, `requiresConfirmation: false`, and `emits: []`.
`actor.type: anonymous` exists only for access logs/traces; event and audit
schemas accept accountable user/system actors only.

Consumer actions are a strict subset: `risk: read`, `audit: false`,
`idempotent: false`, `requiresConfirmation: false`, `emits: []`,
`permissions: []`, `transport: client`, and no `resolveTarget`. Unlike public,
consumer requires authentication (`actor.type: user`) and rate-limits per user
rather than per IP.

## 3. Principal contexts (ADR-0013, ADR-0018)

Discriminated union `ActionCtx`, common fields first:

```ts
type BaseCtx<TDb extends ReadTx = Tx> = {
  db: TDb;                // ReadTx for read actions, Tx otherwise
  requestId: string;
  correlationId: string;  // propagated across ctx.call and events
  actor:
    | { type: "user"; id: string }
    | { type: "system"; id: string }
    | { type: "anonymous"; id: "anonymous" };
  channel: "ui" | "ai" | "system" | "webhook";
  clientIp?: string;       // trusted-proxy normalized; rate-limit use only
  aiTraceId?: string;
  toolCallId?: string;
  deadline: number;
  signal: AbortSignal;     // shared with nested calls/external clients
  log: Logger;            // pino child bound to request/actor/company/action
  emit: (event: DomainEvent) => void;   // outbox insert, same tx (§6)
  call: <A>(action: A, input: In<A>) => Promise<Out<A>>; // ADR-0015 (§9)
};

type StaffCtx<TDb extends ReadTx = Tx> = BaseCtx<TDb> & {
  principal: "staff"; userId: string; companyId: string;
  membership: { role: Role; permissions: string[] };
};
type CustomerCtx<TTarget, TDb extends ReadTx = Tx> = BaseCtx<TDb> & {
  principal: "customer"; userId: string;
  target: { companyId: string; resource: TTarget };
};
type PublicCtx<TTarget, TDb extends ReadTx = Tx> = BaseCtx<TDb> & {
  principal: "public"; target: { companyId: string; resource: TTarget };
};
type SystemCtx<TDb extends ReadTx = Tx> = BaseCtx<TDb> & {
  principal: "system"; serviceName: string;
} & (
  | { scope: "tenant"; companyId: string }
  | { scope: "global"; companyId?: never }
);
type ConsumerCtx = BaseCtx<ReadTx> & {
  principal: "consumer";
  userId: string;
  clientIp: string;
  companyId?: never;
  target?: never;
  membership?: never;
};
```

Construction — exactly one factory per mode, nothing ad-hoc:

- **staff**: better-auth session → `userId`; the transport supplies an active
  company selector (`x-company-id`, contract.md §3), and the factory loads a
  verified `company_members` row. The selector is never authority. Missing
  selector or membership → `PermissionDeniedError`. Phase-0 integration
  depends on the approved minimal companies/membership/RBAC schema slice in
  db.md; core does not own those tables.
- **customer**: better-auth session → `userId`; the action's typed
  `resolveTarget` runs in the execution transaction; the returned resource
  is the proof of ownership/visibility.
- **public**: no session required; the typed `resolveTarget` proves that the
  company/resource is public. The API factory supplies a trusted-proxy
  normalized `clientIp` for rate limiting; public actions are read-only and
  unaudited.
- **system**: constructed only via `createSystemContext(serviceName, scope)`
  by workers/webhook handlers/outbox consumers. `actor_id` becomes
  `system:<serviceName>`. Scope is set explicitly by the enqueuing code —
  a system context is never "all companies" unless the job genuinely is
  (e.g. Nova Poshta dictionary sync).
- **consumer**: better-auth session → `userId`; the API factory supplies
  a trusted-proxy-normalized `clientIp` for per-user rate limiting. No
  company selector is read or expected; no membership or target resolver
  runs. `actor.type` is always `user`. Consumer actions receive a `ReadTx`
  and may access only declared global discovery projections and published
  facts; owning specs and inherited tests enforce this boundary.

Core exposes one `effectiveCompanyId(ctx)` helper used by logging, events,
audit, and operational metadata: staff/system-tenant use `ctx.companyId`;
customer/public use `ctx.target.companyId`; consumer and global system work
return null.
Pre-authorization access logs may have no company, but the authorized action
span and every domain event/audit row carry this resolved scope (null for
consumer — consumer actions never emit events or write audit). AI calls keep
the initiating user as `actor` and set `channel: "ai"` plus trace/tool IDs.

## 4. Execution pipeline

Fixed order, no per-action variation:

1. **Validate input** (Zod). Fail → `ValidationError` (no side effects).
2. **Authenticate principal and read transport selectors** (session/service
   credentials; no authorization is inferred from a selector). Consumer
   actions require a valid session but skip the company selector entirely.
3. **Rate limit** (§10). Fail → `RateLimitError`.
4. **Authorization preflight** in a short read-only transaction when the
   action needs confirmation or idempotency: verify staff membership or run
   the typed customer/public `resolveTarget`. Consumer actions skip this step
   (no company scope, no resolver, no confirmation/idempotency). This
   prevents unauthorized challenges/idempotency rows but is never the only
   authorization check.
5. **Replay probe + confirmation gate** (`requiresConfirmation` actions,
   §7): a completed idempotency record replays before checking the
   single-use challenge; otherwise validate/consume the challenge.
6. **Idempotency reserve** (idempotent writes, §5) after confirmation.
7. **Open execution transaction** (read-only for `risk: read`); re-run
   membership/target authorization in this transaction to prevent TOCTOU
   (consumer actions have no membership/target — session validity is
   sufficient), set the transaction-local DB statement timeout, then run
   the handler with the remaining deadline/abort signal.
8. **Validate output** with the declared Zod schema before any commit; a
   mismatch is `CoreInvariantError` (server bug), never a client validation
   error.
9. Inside the same transaction: outbox inserts from `ctx.emit`, successful
   audit record (§8), idempotency finalize (§5).
10. **Commit**. Failures roll back handler/outbox/audit/finalization, then
    record the failed audit outcome and mark the idempotency key `failed` in
    a separate short transaction.

The pipeline emits one structured log line (start/finish) with
`request_id`, `actor`, `company_id` (null for consumer and global system),
`action`, `outcome`, `duration_ms`, and an OTel span; errors go to Sentry
with the same correlation fields.

`risk: draft` is still a mutation: it receives a writable transaction and
must declare idempotency/audit according to its spec. It is not callable
through cross-module `ctx.call`, which accepts `risk: read` only.

## 5. Idempotency protocol

Applies to actions declaring `idempotent: true` with `risk` ≠ `read`
(read actions are naturally idempotent — no key, no storage).

- **Key source**: callers supply `idempotencyKey` (oRPC meta/header from
  clients; the AI loop uses its tool-call id; workers use the job id;
  webhook handlers use the provider's delivery/event id). The client SDK
  helper generates one UUID per logical submit and retains it for retries.
  The server cannot infer a logical button press: a missing key on an
  idempotent mutation is a `ValidationError`, never silently generated.
- **Scope**: unique on
  `(principal key, scope key, action name, idempotency key)`, where
  principal key includes mode + accountable identity
  (`staff:<userId>`, `customer:<userId>`, or `system:<serviceName>`).
  Scope key is `company:<effectiveCompanyId>` for every tenant-scoped action
  and `global` only for a declared global system action. Both actor and scope
  are required: omitting actor lets one staff member replay another's result;
  omitting scope lets a system service collide across companies.
- **Request hash**: SHA-256 over RFC 8785 canonical JSON of the JSON-safe
  validated input plus principal key and scope key.
- **States**: `in_progress` → `completed` | `failed`.
- **Flow**: (a) INSERT `in_progress` + request hash in its own short tx —
  unique violation means: existing `completed` + same hash → **replay the
  stored response** (no handler run); `completed` + different hash →
  `IdempotencyConflictError`; `in_progress` → `ConcurrentRetryError`
  (retry-after); `failed` or an expired in-progress lease → conditional
  takeover with a new `attemptId`, so only one caller wins. The lease is the
  action timeout plus a bounded safety margin; long handlers renew it.
  (b) Handler tx
  runs; the key row is updated to `completed` with a response snapshot
  **inside the handler tx** — the Zod-validated, JSON-safe response snapshot
  and effects commit atomically. Idempotent action outputs must not contain
  expiring credentials or signed URLs. (c) On error: mark `failed` (separate
  tx).
- **Confirmed retries**: for `requiresConfirmation` actions, a read-only
  idempotency probe runs before challenge validation. `completed` replays the
  result and an active `in_progress` returns `ConcurrentRetryError`. When a
  challenge is consumed, its ID/confirmation time/expiry are persisted with
  the reservation. A failed/stale attempt may reuse that persisted grant only
  while it is unexpired and all request bindings match; otherwise it needs a
  new challenge. This survives a crash after reservation without making the
  raw challenge token reusable.
- **Retention**: keys expire after 48h (`expires_at`, cleaned by a worker
  job); replay after expiry re-executes — callers must not rely on replay
  beyond the retry window.

## 6. Domain events

Envelope (stored in `domain_events`, spec'd in db.md):

```ts
{ eventId: uuid,            // UUIDv7 (time-ordered), generated in ctx.emit
  name: "orders.confirmed", // <module>.<pastVerb> (conventions)
  version: 1,               // payload schema version; bump on breaking change
  occurredAt, companyId,     // UUID; null only for declared global system events
  aggregate: { type: "order", id, sequence }, // monotonic per aggregate
  actor: { type: "user" | "system", id,
           channel: "ui" | "ai" | "system" | "webhook" },
  requestId, correlationId,
  causationId,              // eventId or requestId that caused this event
  payload }                 // Zod-validated against the event definition
```

- **Definitions**:
  `defineEvent({ name, version, scope: "tenant"|"global", payload })` in
  the emitting module's `events/`. `ctx.emit` validates payload and inserts
  into the outbox in the action's transaction (ADR-0012: claim via
  `FOR UPDATE SKIP LOCKED`, LISTEN/NOTIFY poller in apps/worker).
- **Subscriptions**:
  `defineEventHandler({ event, consumer, action })` binds an event to a
  consuming module action; it does not accept arbitrary DB logic.
  `consumer` is stable (`chat.order-card-updater`). The target action must be
  transport-internal, AI-internal, system-principal, write/idempotent, and
  accept the event envelope as input. Core invokes it with a system context
  scoped to the event's `companyId`; a null company is allowed only for an
  explicitly global event/action.
- **Delivery**: at-least-once. The dispatcher materializes one
  `event_deliveries` row per registered consumer and marks the outbox event
  dispatched in the same transaction. **Consumer dedup** is mandatory:
  `(consumer, eventId)` is unique. The dispatcher runs the bound system
  action through the normal action pipeline in the delivery transaction
  (special core entrypoint, not `ctx.call`); transition to `processed`,
  action effects, audit, and emitted events commit together. A redelivery is
  a no-op. For this entrypoint the unique delivery row is the idempotency
  reservation (key = event ID), so no second `idempotency_keys` row is used.
- **Ordering**: `ctx.emit` increments a foundation sequence row in the same
  transaction, giving every event a monotonic per-aggregate sequence. A
  consumer handles only its earliest non-processed delivery for that
  aggregate and holds a transaction-scoped `(consumer, aggregate)` advisory
  lock while applying effects. Nothing is guaranteed across aggregates.
  Handlers must still tolerate replays.
- **Failure**: `event_deliveries` tracks
  `pending|processing|processed|dead`, attempts, next attempt, claim owner,
  and last error. Retry with exponential backoff (5 attempts), then the
  delivery is parked for that consumer and alerting fires. Replay = changing
  dead deliveries back to pending (admin script; a phase-0 CLI task). Other
  consumers of the same event are not blocked.
- **Retention**: processed outbox rows are kept (they are the audit-grade
  event history) and partitioned/archived post-MVP if volume demands.

## 7. Confirmation protocol (`requiresConfirmation`)

Two-step, single-use, channel-agnostic (same for UI and AI — ADR-0008):

1. Invocation **without** a confirmation token completes authorization
   preflight and stops: core uses the required `confirmationSummary` callback,
   issues `{ challengeId, actionName, inputHash, principalKey, companyId,
   idempotencyKey, expiresAt (5 min) }` (Redis), and returns
   `ConfirmationRequiredError` carrying only the redacted summary. The AI
   surfaces this as a confirmation card; the classic UI as a dialog.
2. Re-invocation with `{ challengeId }` + identical input (hash-checked)
   executes. A challenge is consumed atomically (single use), bound to the
   same principal, company, and idempotency key, and expires. Any mismatch →
   new challenge required. Core stores the consumed grant on the idempotency
   reservation; a completed result may replay and a stale execution may
   safely resume under that unexpired grant without reusing the raw token
   (§5).
3. QES signing remains client-side regardless: `documents.sign`'s server
   part only records the client-produced signature; the confirmation
   protocol cannot substitute for key possession.

Redis unavailability fails closed for confirmation: high-risk execution does
not proceed, even if ordinary authenticated read rate limits are fail-open.

## 8. Audit

For every action with `audit: true` (mandatory for `write`/`high`), one row
in `audit_log` written in the handler transaction:

`{ id, requestId, correlationId, action, actorType: user|system,
actorId, channel: ui|ai|system|webhook, aiTraceId?, toolCallId?, companyId, targetType,
targetId, inputHash, outcome: ok|<errorCode>, durationMs, createdAt }`

AI trace/tool-call IDs provide attribution without storing prompts or model
content in the audit row.

- **Permission denials** on `audit: true` actions are also recorded
  (outcome `PERMISSION_DENIED`, separate tx since no handler tx exists).
- **No raw input by default** — only the hash. An action may opt in to a
  redacted input snapshot via `auditSnapshot: (input) => SafeJson`; storing
  unredacted input is forbidden (prohibitions: no PII/secrets in logs).
- Read access: no UI in MVP; queryable by operators via SQL. Retention:
  12 months online, then export/archive or delete according to the operations
  policy. Audit rows are not an event store.

## 9. `ctx.call` (ADR-0015)

- Callable targets: another module's `risk: "read"` actions only (runtime
  assert + CI check), and the callee must support the caller's principal
  mode. Same-module composition uses `services/`, not `call`.
- Consumer callers may only invoke other `consumer`-principal `risk: read`
  actions; company-scoped callees (`staff`, `customer`, `public`,
  system-tenant) are rejected at both CI and runtime because the consumer
  context carries no `companyId` to propagate.
- The callee runs in the caller's transaction and principal context but sees
  only a `ReadTx` facade even when the caller's transaction is writable; the
  callee's own `permissions`/`resolveTarget` still execute (defense in
  depth). For customer/public calls, the resolver receives the caller's
  verified `inheritedCompanyId` and must return the same company; a mismatch
  is `CoreInvariantError`. Timeout budget is shared; audit gets a child entry only if the
  callee itself declares `audit: true` (rare for reads); logs/spans always
  nest via `correlationId`.
- Depth limit 3, cycle detection by action name — exceeding either is a
  `CoreInvariantError` (a bug, not a user error).

## 10. Rate limiting

Redis token bucket per `(action, rate-limit scope key)`. Defaults: `public`
30/min per rotating HMAC of trusted-proxy-normalized IP; `consumer` 60/min
per user; `customer`/`staff` 120/min per user; `system` unlimited. Raw IP
remains transport-only and is never the Redis key or a domain log/audit
field. Per-action override via `rateLimit`. AI tool invocations additionally
consume a per-conversation budget (defined in the phase-5 spec; core only
exposes the hook). Exceeded → `RateLimitError` with `retryAfterSec`. Redis
failure is fail-closed for public/auth/high-risk actions and fail-open with
an error log for ordinary authenticated reads; system actions define their
policy in the spec.

## 11. Typed errors

`packages/core/errors` — the only error vocabulary for domain code:

`ValidationError` (Zod issues) · `PermissionDeniedError` · `NotFoundError` ·
`ConflictError` (domain state conflicts, e.g. status transition) ·
`IdempotencyConflictError` · `ConcurrentRetryError` ·
`ConfirmationRequiredError` (carries challenge) · `RateLimitError` ·
`TimeoutError` · `CoreInvariantError` (bugs: tenant leak, call cycle —
alerts, never shown to users).

Each has a stable `code` for the contract layer (HTTP/oRPC mapping in
contract.md) and a client-safe message; internal details stay in logs.

## 12. Module test kit

Exported from `packages/core/testing`, used by every module (this is how
"every module inherits the invariant tests" becomes real):

- `buildTestContext(mode, overrides)` — context factories for all five
  principal modes against the Testcontainers DB (harness in db.md).
- `crossTenantSuite(actions)` — parameterized by each action's declared
  principal: staff of company A vs data of B; customer X vs resources of Y;
  public vs non-public resources; system scoped to A touching B; or consumer
  vs unpublished/company-private data. Every module instantiates the relevant
  case for each action — omission fails the contract check.
- `consumerIsolationSuite(actions)` — for `consumer`-principal actions:
  unpublished entities are hidden, no CRM side effects, no company-private
  data leakage.
- `idempotencySuite(action)` — replay, conflict, concurrent-retry cases.
- `eventSuite(module)` — declared events emitted transactionally (rollback
  removes them), consumer dedup respected.

## 13. Acceptance criteria

- [ ] Contract check fails on every §2 violation (test per rule), including
      consumer-specific constraints (resolver present, non-read risk, audit,
      events, permissions, or non-client transport on a `consumer` action).
- [ ] All five context factories work; no other construction path exists.
- [ ] Pipeline order is §4 exactly; a failing handler rolls back outbox and
      audit rows written in the same tx.
- [ ] Output schema mismatch rolls back and maps to internal error.
- [ ] `risk: read` actions cannot compile against mutation methods and a
      top-level runtime write attempt fails in the DB read-only transaction.
- [ ] Idempotency: replay returns the stored response without re-running
      the handler; same-key/different-payload → conflict; concurrent
      double-submit runs the handler exactly once; a crashed/stale lease can
      be taken over by exactly one retry (race tests).
- [ ] Events: emit is transactional; redelivery is a consumer no-op;
      per-aggregate ordering holds under concurrent dispatch; a dead event
      for consumer A does not block consumer B.
- [ ] Core exposes dispatcher/consumer libraries only; process loops,
      polling, retries, and shutdown run in `apps/worker`.
- [ ] Confirmation: challenge is single-use, principal-bound, hash-bound,
      company/idempotency-bound, expiring; execution without a valid
      challenge is impossible.
- [ ] Audit rows written for `audit: true` incl. permission denials; AI
      calls retain the initiating user as actor and `channel: ai`.
- [ ] `ctx.call`: write target rejected; permissions of callee enforced;
      tx shared (callee sees caller's uncommitted writes); consumer caller
      invoking a company-scoped callee is rejected.
- [ ] Cross-tenant suite passes for the reference slices in all modes.
- [ ] Consumer isolation suite: unpublished entities hidden, no CRM record
      created, no company-private data returned, rate limit at 60/min per
      user.

## 14. Resolved decisions

1. Audit input policy — **hash-only by default**, per-action opt-in
   redacted snapshot via `auditSnapshot` (owner, 2026-08-17).
2. Idempotency retention window — **48h** (owner, 2026-08-17).

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Added the consumer context, action constraints, logging, call rules, rate limit (60/min per user), and inherited isolation tests | Align the frozen foundation with ADR-0018 authenticated discovery | Human owner via spec-rework queue |
| 2026-08-17 | Tightened target resolution, idempotency scope, event delivery, confirmation, audit, and output validation | Foundation consistency review against blueprint and ADR-0013/0015 | GPT-5.6 Sol |
| 2026-08-17 | Initial draft | — | spec agent (Fable 5) |
