# Shozee 2.0 — Agent Instructions

Ground-up rewrite of Showzy v1: a business operating platform for Ukrainian
small businesses. Classic UI and AI chat execute the same actions.

## Contract of this thread

The executable contract is the Linear feature card plus `*.contract.ts` and
the tests in the definition of done. Protocol manuals for frozen packages
live in `docs/specs/` (`core`, `db`, `contract`, `money`,
`security-operations`, `companies-foundation`). Domain novels in
`docs/archive/specs/` are research, not a gate. Do not contradict an
accepted ADR in `docs/adr/`; deviations need a new ADR first.

Constitution and conventions are in `.cursor/rules/` (already applied).

## Non-negotiable invariants (blueprint §2.1)

1. **Tenant isolation.** Tenant scope comes from a verified action context
   (staff membership, typed customer/public/share target resolver, explicit
   system scope, or null company for `consumer` and declared public global
   discovery projections — ADR-0013, ADR-0018, ADR-0020, ADR-0022), never
   from an input identifier as an access grant.
   Cross-tenant access must be impossible and is verified by tests every
   module inherits.
2. **Idempotency.** Orders, payments, document generation, webhooks, and
   AI-invoked actions are safely retryable.
3. **Money snapshots.** Order items store immutable price/discount/tax
   snapshots captured at creation time. Never recompute old orders from
   current pricing.
4. **Observability / audit.** Authorized tenant actions carry `request_id`,
   accountable `actor_id` (user/system), invocation `channel`,
   `company_id`, and `action`; global system work has null company and public
   reads use log-only actor `anonymous` (never audit/events).
5. **Projections never own domain state.** Chat is the primary interaction
   surface for orders, but the order domain is the source of truth. A chat
   message stores `orderId`, never order status. `orders` emits events
   (`orders.confirmed`); `chat` subscribes and materializes cards.

## Core rules

- **One data path.** All business logic goes through `defineAction`. Clients
  never touch the DB directly. Authorization lives in action `permissions`.
- **TypeScript strict end-to-end.** No `any`, no `as unknown as`.
- Modules (`packages/modules/*`) export only actions and events. No direct
  cross-module imports (enforced by ESLint boundaries). Cross-module writes
  are asynchronous events unless ADR-0021 explicitly declares a
  same-transaction atomic capability.
- Explicit code, no magic: no decorators with hidden behavior, no DI
  containers.
- All code, comments, and documentation are in **English**.

See `.cursor/rules/` for detailed conventions, prohibitions, and the
definition of done.

## CI flakes

A red Vitest on an unrelated file is a **flake or a real regression**,
not a reason to retrigger CI. Open or reuse a Linear issue with the
`flake` label. Never push `--allow-empty` (or an equivalent no-op
commit) to turn CI green. Do not add Vitest `retry` or GitHub Actions
rerun-on-failure — those hide the same bugs. Details:
`docs/operations/ci-flakes.md`.

When the task touches `apps/mobile`, load
`.cursor/skills/showzy-mobile/SKILL.md` before writing code. Do not load
Expo skills for backend or module work.

When the task touches `apps/web`, load
`.cursor/skills/showzy-web/SKILL.md` and `apps/web/AGENTS.md` before
writing code. Do not load Expo skills for web work. The panel is a Vite
SPA (ADR-0030), not the mobile client and not the future storefront.

## Feature conveyor

`/implement SHO-<parent>` (or `/ticket` / `/conveyor` on a Feature
parent) runs the autonomous parent orchestrator: isolated cloud
`/ticket` per child, independent reviews from the parent, squash-merge
on green GitHub Actions and, when launched, a finished `/review`.
Children on one feature are sequential by default. Playbook:
`.cursor/commands/conveyor.md`. ADR-0029. A human closes the feature
parent. Nested Bugbot / `/review` / `security-review` inside a cloud
child are expected to be unavailable — do not fail the child for that.

## Legacy reference (Showzy v1)

The previous implementation lives in a separate repository (locally at
`E:\showzy`). **Never modify it.** Curated extracts in this repo are
usually enough:

- `docs/reference/v1-backend-audit.md`
- `docs/reference/v1-database.types.ts`
- `docs/reference/v1-migrations/`

The v1 schema is a reference, not a template. V2 uses code-level
permissions and Drizzle in action handlers (blueprint §6).
