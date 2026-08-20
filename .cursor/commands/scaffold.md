# Scaffold leftover foundation (phases 0–1 only)

You are the **scaffold agent** for Showzy 2.0. Unlike `/implement`, you ARE
allowed to create and modify the foundation packages — that is the whole
point of this stage. This command is used only for leftover phase 0–1
foundation work. New domain features use `/feature` (ADR-0023), including
the golden backend slice.

## Allowlist — you may create/modify ONLY

- `packages/core` — `defineAction`, principal contexts (ADR-0013), registry,
  `ctx.call` (ADR-0015), outbox client, event bus, idempotency, audit,
  typed errors.
- `packages/db` — Drizzle schema (`src/schema/<module>.ts` + `foundation.ts`,
  ADR-0014), migrations, seed, Testcontainers harness. Domain schema for a
  golden slice may land here when the `/feature` ticket says so.
- `packages/contract` — oRPC router derived from the registry; the
  client-safe contract layer (no Node/DB imports reachable from clients).
- `packages/config` (validated env) and `packages/tooling` (eslint presets
  incl. boundaries, tsconfig, prettier).
- Minimal `apps/api` transport/auth composition, `apps/worker` outbox
  dispatcher, and client bundle-probe fixture required to execute the
  foundation protocols; no product UI.
- CI workflows, Docker Compose, root monorepo config, per-package `AGENTS.md`.

Everything else (other domain modules, mobile app features) is out of scope —
stop and report if a task seems to require it. Payments / feature-flag
skeletons wait on a `/feature` card, not a markdown spec.

## Process

1. Work from the protocol manuals in `docs/specs/` (`core`, `db`,
   `contract`, `security-operations`, `money`, `companies-foundation`),
   accepted ADRs (especially ADR-0016), the ownership map, and completed
   v1 migration-matrix slices. Patch a protocol manual in this PR only
   when a test proves it wrong. Unresolved product decisions stop the
   task.
2. **Merge one foundation PR at a time.** You may prepare the next
   non-conflicting task on another branch while a PR is in review.
   Dependency order still holds. ~300 lines is review comfort. Sensitive
   and first-core PRs get full human review plus `/guard`; mechanical
   scaffold PRs get CI + a human skim.
3. Tests required for the foundation invariants (blueprint §2.1) that
   later modules inherit: the cross-tenant harness is parameterized over
   all principal modes (ADR-0013). Red-then-green is not required for
   schema or config.

## Exit gates (phase 0–1 leftover)

- `tsc`, ESLint boundaries, Vitest (unit + Testcontainers integration), and
  the contract check are green in CI, with branch protection enabled.
- Foundation invariant test suites pass: tenant isolation (all principal
  modes), idempotency protocol, money snapshot immutability, audit records,
  projection ownership.
- The golden backend slice is **not** this command's job. Land it via
  `/feature` so it becomes the copy template (ADR-0023).
