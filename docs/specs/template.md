# Spec: <module>

> Status: Living | Active | Mixed. Approved by: <owner>, <date>.
> Active surface: none. | entire file. | §<n> slice (<actions>, <tables>, <events>).
> Remainder: Living intent. Update Active surface when a later slice merges.
> Density beyond the declared slice is intent, not contract; do not treat unimplemented sections as frozen.
> (Omit the density line when Active surface is entire file.)
> Written against blueprint §<...>, scope §<...>, ADR-0013, ADR-0015,
> ADR-0020, ADR-0021, and module-specific decisions.
>
> See `docs/specs/README.md`. `/rework-spec` applies only to Active surface.

## Living intent (always)

Required while the file is Living or Mixed. Do not novelize unimplemented
phases. Budget roughly 100–200 lines when this module is not the next slice.

### Purpose

2–4 sentences: what the module owns, what it explicitly does NOT own.

### Invariants and principal modes

Which of `staff` | `customer` | `public` | `system` | `consumer` | `account`
this module will use, and any module-specific invariants (tenant, money,
projections). Principal selection guidance is below.

### Named capabilities

Action and event **names** plus one-line intent. No full Zod tables, per-action
timeout/rate-limit rows, or complete CHECKs for phases that are not about to
be built. Owned-table **names** if already known.

### Principal selection guidance

Choose the correct principal mode based on **who is acting** and **what scope**:

- **`staff`** — an authenticated user acting as a member of a specific company
  (panel surface). Company scope comes from verified membership. Use for all
  company management, CRUD of company-owned resources, and company
  configuration.
- **`customer`** — an authenticated user acting on a specific company they do
  not manage (cabinet surface). Company scope comes from a typed
  `resolveTarget` proving ownership/visibility of a company-scoped resource
  (own order, own conversation, own document). Use for checkout, chat, order
  viewing, document signing — any action that requires a specific company
  context without staff membership.
- **`consumer`** — an authenticated user performing global **cross-company
  discovery** without any company context. Read-only; no `companyId`; no
  `resolveTarget`. Use for search, browse published companies/products,
  category filtering — pre-company-selection actions. The user transitions
  to `customer`/`public` when selecting a specific company.
- **`account`** — an authenticated user managing **their own account-level
  resources** without a company context. No `companyId`; `userId` is the
  sole authorization basis. May perform writes. Use for creating a company,
  listing own companies, managing personal profile/settings — pre-tenant
  operations that precede the selection of a company to act within.
- **`public`** — unauthenticated read-only access. Use `publicScope: target`
  with a resolver for one published resource. Use
  `publicScope: globalProjection` without a resolver only for an allowlisted
  published discovery projection (ADR-0020).
- **`system`** — machine actors (workers, cron, webhook handlers, outbox
  dispatcher). Named service identity; explicit tenant scope set by the
  enqueuing code.

## Slice / Active contract (Active surface only)

Required for actions and tables in the Active surface (or for the slice
about to be built). Schema columns freeze when their schema PR merges.

### Owned tables

Tables in `packages/db/src/schema/<module>.ts` (ADR-0014): columns, types,
indexes, constraints, FKs (note which reference other modules' tables).
State machine columns get their allowed values and transitions below.

### Actions

For every action **in this slice**, the full contract:

| Field | Value |
| --- | --- |
| Name | `<module>.<verb>` |
| Description | Written as an instruction to the AI model |
| Principal | `staff` \| `customer` \| `public` \| `system` \| `consumer` \| `account` (ADR-0013, ADR-0018, ADR-0020) |
| Transport | `client` \| `internal` (system must be internal; public/consumer/account must be `client`) |
| Target/public/system scope | Typed `resolveTarget` for customer/public-target; `publicScope: globalProjection` + declared `projectionGrant` for anonymous cross-company reads; `tenant`/`global` for system; N/A for consumer/account |
| Input / Output | Zod shapes as TypeScript |
| Permissions | e.g. `orders:create`; must be `[]` for customer/public/consumer/account/system |
| aiExposure / risk / requiresConfirmation | Public/consumer: `risk: read`, `requiresConfirmation: false`; aiExposure `exposed` or `internal` |
| Confirmation summary | Required redacted server callback when confirmation is required |
| Idempotent | If true: key source, scope, and conflict behavior; public/consumer must be `false`; social desired-state writes must be retry-safe |
| Emits | Events; public/consumer must be `[]` |
| Audit / Timeout / Rate limit | Public/consumer: `audit: false`; account: per action; declare abuse-sensitive social overrides |
| Audit target/snapshot | Required target callback when audited; optional explicitly redacted snapshot |
| Calls (`ctx.call`) | Cross-module read actions used (ADR-0015); consumer callers may only call other `consumer`-principal reads |
| Atomic calls | `atomicCalls`/`atomicCallers` edges and rollback invariant, or `[]` (ADR-0021) |

### Events

- **Emitted**: name (`<module>.<pastVerb>`), payload shape, envelope
  version, expected subscribers.
- **Consumed**: which modules' events this module subscribes to, and what
  internal idempotent system action each subscription invokes; describe what
  it materializes (projections store IDs, never authoritative domain state —
  ADR-0011).
- **Read-model grants**: tables of this module other modules may read
  directly (`search`, `analytics` — ADR-0015), plus named public projection
  grants with table/field allowlists (ADR-0020), if any.

### State machines and concurrency

- Status fields: allowed values, allowed transitions, who/what triggers each.
- Concurrency: what happens on simultaneous conflicting operations
  (two staff editing, checkout racing a price change, retry racing success).
- Social desired-state/counter concurrency: duplicate set-state requests,
  opposite-state races, optimistic client reconciliation, and counter repair.
- Atomic capabilities: stable lock order and all-or-nothing caller/callee
  rollback where ADR-0021 applies.
- Transaction boundaries for multi-table writes.

### Edge cases

Enumerate explicitly — this is where v1 reference digging pays off. Include
abuse/rate-limit/moderation cases for public/social surfaces and cite the v1
migration/behavior each case comes from.

### v1 migration notes

For the v1 tables/triggers/RPCs/RLS policies this module replaces:
keep / transform / drop, and where the behavior moves (action, event,
service, or deliberately dropped). This is the module's slice of the
`docs/reference/v1-migration-matrix.md`; expand every carried table to
column-level mapping, cleanup, reconciliation, cutover, and rollback. No
`REVIEW` item may remain when the spec is approved.

### Non-functional requirements

Only where they deviate from defaults: rate limits, payload size limits,
expected volumes, latency-sensitive paths, PII fields and their handling in
logs/audit.

### Acceptance criteria

Testable statements. Mandatory minimum, plus module-specific ones:

- [ ] Cross-tenant/isolation behavior per relevant principal mode (ADR-0013,
      ADR-0018, ADR-0020)
- [ ] Mode-appropriate authorization denial (permission, ownership,
      visibility, system scope, consumer published-only access, or account
      own-user-only access)
- [ ] Consumer actions (if any): contract check rejects `resolveTarget`;
      published-only access (no unpublished entities); no CRM creation/side
      effects; `audit: false` and `emits: []`; instantiate inherited
      `consumerIsolationSuite` from core.md §12
- [ ] Public-target/global actions (if any): correct resolver vs projection
      grant; published/field allowlist; no CRM/domain side effects;
      `audit: false`, `emits: []`, anonymous rate limit; instantiate
      `publicProjectionSuite` for global projection actions
- [ ] Account actions (if any): contract check requires `permissions: []`;
      own-user-only access (user A cannot see/modify user B's companies or
      personal data); no company-scoped resource access; structured logs carry
      null `company_id`; instantiate inherited `accountIsolationSuite` from
      core.md §12
- [ ] Validation failure surfaces typed errors
- [ ] Output validates at runtime and is JSON-safe (money is a decimal string
      on the wire, not a JSON number)
- [ ] Idempotency behavior where declared (retry-safe, conflict on
      same-key/different-payload)
- [ ] Social desired-state actions (if any): retry and opposite-state races,
      optimistic reconciliation after server response, own-collection
      isolation, abuse limits, and exact counter/event concurrency
- [ ] Declared atomic edges (if any): instantiate `atomicCallSuite`; root and
      callee commit/roll back together; undeclared/nested edge rejected
- [ ] Declared events are emitted transactionally (outbox)
- [ ] Audit records written for `audit: true` actions

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-19 | Split Living intent vs slice/Active contract; mandatory Active surface header | Phase-0 spec-process plan (sp-T1) | owner via spec-process-after-phase-0 |
| 2026-08-17 | Added public-global, social concurrency/abuse, optimistic reconciliation, and atomic-call requirements | Rebaseline module specs for ADR-0020/0021 mobile parity | Human owner via mobile parity rework |
| 2026-08-17 | Added principal selection guidance (account vs consumer vs customer); added account action test requirements; extended Target/Permissions/Audit rows for account | Complete Step 2 of spec-rework queue (ADR-0018 integration) | Spec-rework agent |
| 2026-08-17 | Completed consumer action metadata and mandatory test guidance | Close the ADR-0018 Step 2 template gap | Human owner via spec-rework queue |
