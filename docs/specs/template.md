# Spec: <module>

> Status: Draft | Approved (frozen). Approved by: <owner>, <date>.
> Written against blueprint §<...>, scope §<...>, ADR-<...>.

## 1. Purpose

2–4 sentences: what the module owns, what it explicitly does NOT own.

## 2. Owned tables

Tables in `packages/db/src/schema/<module>.ts` (ADR-0014): columns, types,
indexes, constraints, FKs (note which reference other modules' tables).
State machine columns get their allowed values and transitions in §5.

## 3. Actions

For every action, the full contract:

| Field | Value |
| --- | --- |
| Name | `<module>.<verb>` |
| Description | Written as an instruction to the AI model |
| Principal | `staff` \| `customer` \| `public` \| `system` \| `consumer` (ADR-0013, ADR-0018) |
| Transport | `client` \| `internal` (system must be internal; consumer must be `client`) |
| Target/system scope | Typed `resolveTarget` for customer/public; `tenant`/`global` for system; **N/A for consumer** (no company scope, no `resolveTarget` — ADR-0018) |
| Input / Output | Zod shapes as TypeScript |
| Permissions | e.g. `orders:create`; must be `[]` for customer/public/consumer/system |
| aiExposure / risk / requiresConfirmation | Consumer: `risk: read`, `requiresConfirmation: false`; aiExposure `exposed` or `internal` |
| Confirmation summary | Required redacted server callback when confirmation is required |
| Idempotent | If true: key source, scope, and conflict behavior; consumer must be `false` |
| Emits | Events (see §4); consumer must be `[]` |
| Audit / Timeout | Consumer: `audit: false` (no `auditTarget`) |
| Audit target/snapshot | Required target callback when audited; optional explicitly redacted snapshot |
| Calls (`ctx.call`) | Cross-module read actions used (ADR-0015); consumer callers may only call other `consumer`-principal reads |

## 4. Events

- **Emitted**: name (`<module>.<pastVerb>`), payload shape, envelope
  version, expected subscribers.
- **Consumed**: which modules' events this module subscribes to, and what
  internal idempotent system action each subscription invokes; describe what
  it materializes (projections store IDs, never authoritative domain state —
  ADR-0011).
- **Read-model grants**: tables of this module other modules may read
  directly (`search`, `analytics` — ADR-0015), if any.

## 5. State machines and concurrency

- Status fields: allowed values, allowed transitions, who/what triggers each.
- Concurrency: what happens on simultaneous conflicting operations
  (two staff editing, checkout racing a price change, retry racing success).
- Transaction boundaries for multi-table writes.

## 6. Edge cases

Enumerate explicitly — this is where v1 reference digging pays off. Cite the
v1 migration/behavior each case comes from.

## 7. v1 migration notes

For the v1 tables/triggers/RPCs/RLS policies this module replaces:
keep / transform / drop, and where the behavior moves (action, event,
service, or deliberately dropped). This is the module's slice of the
`docs/reference/v1-migration-matrix.md`; expand every carried table to
column-level mapping, cleanup, reconciliation, cutover, and rollback. No
`REVIEW` item may remain when the spec is approved.

## 8. Non-functional requirements

Only where they deviate from defaults: rate limits, payload size limits,
expected volumes, latency-sensitive paths, PII fields and their handling in
logs/audit.

## 9. Acceptance criteria

Testable statements. Mandatory minimum, plus module-specific ones:

- [ ] Cross-tenant isolation per relevant principal mode (ADR-0013, ADR-0018)
- [ ] Mode-appropriate authorization denial (permission, ownership,
      visibility, system scope, or consumer published-only access)
- [ ] Consumer actions (if any): contract check rejects `resolveTarget`;
      published-only access (no unpublished entities); no CRM creation/side
      effects; `audit: false` and `emits: []`; instantiate inherited
      `consumerIsolationSuite` from core.md §12
- [ ] Validation failure surfaces typed errors
- [ ] Output validates at runtime and is JSON-safe (money is a decimal string
      on the wire, not a JSON number)
- [ ] Idempotency behavior where declared (retry-safe, conflict on
      same-key/different-payload)
- [ ] Declared events are emitted transactionally (outbox)
- [ ] Audit records written for `audit: true` actions

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Completed consumer action metadata and mandatory test guidance | Close the ADR-0018 Step 2 template gap | Human owner via spec-rework queue |
