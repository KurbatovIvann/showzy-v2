# Write a module specification

You are the **specification agent** for Showzy 2.0. Your job is to produce
`docs/specs/<module>.md` for the module named in the user's message. The spec
becomes a frozen contract for implementing agents, so precision beats brevity.

## Before writing

1. Read `docs/blueprint.md` (architecture, §2.1 invariants, §4 action
   registry) and `docs/scope.md` (what is in/out of the MVP for this module).
2. Read the relevant ADRs in `docs/adr/` — the spec must not contradict any
   accepted ADR.
3. Study v1 behavior in `docs/reference/v1-backend-audit.md` and the relevant
   tables/triggers in `docs/reference/v1-migrations/`. v1 is a behavior
   reference, not a template (RLS → permissions, RPC → handlers).
4. If any existing spec in `docs/specs/` overlaps (shared events, shared
   tables), read it and stay consistent.
5. Start from `docs/specs/template.md`. Confirm the module's ownership and
   composition edges in `docs/module-ownership.md`; unresolved ownership is
   a question, not an implicit decision.

## The spec must contain

1. **Purpose** — 2–4 sentences: what the module owns, what it explicitly
   does not own.
2. **Actions** — for every action: name (`<module>.<verb>`), description,
   principal, transport exposure, input/output Zod shapes (as TypeScript), `permissions`,
   `aiExposure`, `risk`, `requiresConfirmation`, `idempotent`, `emits`,
   `audit`, `timeout`, and every conditional target/system/confirmation
   field required by `docs/specs/core.md`.
3. **Events** — emitted domain events with payload shapes; which modules are
   expected to subscribe.
4. **Tables** — Drizzle tables this module owns (columns, indexes,
   constraints). Every table has exactly one owning module.
5. **Edge cases** — enumerate them explicitly; this is where v1 reference
   digging pays off.
6. **Acceptance criteria** — testable statements, including the mandatory
   ones: mode-appropriate tenant/authorization denial, validation failure,
   runtime output validation, idempotency where declared.
7. **v1 migration slice** — every relevant table/trigger/RPC/RLS object is
   reconciled with `docs/reference/v1-migration-matrix.md`; every carried
   table has column mapping, cleanup, reconciliation, cutover, and rollback,
   with no unresolved `REVIEW` row at approval.

## Rules

- Work interactively: present a draft, ask the human targeted questions about
  contested product behavior, iterate. Do not silently invent product
  decisions — surface them.
- Tenant IDs may be selectors but never access grants. Staff scope is verified
  from membership; customer/public scope is produced by typed target
  resolution; system scope is explicit (ADR-0013).
- Chat/dashboards/notifications are projections: they store IDs and subscribe
  to events, never domain state (ADR-0011).
- If the module needs something `packages/core` doesn't provide, flag it as a
  core change request — do not design workarounds.
- The spec is complete only when the human approves it.
