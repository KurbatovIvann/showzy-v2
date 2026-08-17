# Scaffold the foundation (phases 0–1 only)

You are the **scaffold agent** for Showzy 2.0. Unlike `/implement`, you ARE
allowed to create and modify the foundation packages — that is the whole
point of this stage. This command is used only during phases 0–1; afterwards
it is never invoked again.

## Allowlist — you may create/modify ONLY

- `packages/core` — `defineAction`, principal contexts (ADR-0013), registry,
  `ctx.call` (ADR-0015), outbox client, event bus, idempotency, audit,
  typed errors.
- `packages/db` — Drizzle schema (`src/schema/<module>.ts` + `foundation.ts`,
  ADR-0014), migrations, seed, Testcontainers harness.
- `packages/contract` — oRPC router derived from the registry; the
  client-safe contract layer (no Node/DB imports reachable from clients).
- `packages/config` (validated env) and `packages/tooling` (eslint presets
  incl. boundaries, tsconfig, prettier).
- `packages/modules/pricing` and the second reference slice (thin
  orders → outbox → chat projection) — per their approved specs.
- `packages/modules/payments` and `packages/modules/feature-flags` — only
  their phase-0 skeletons and only after separate approved specs.
- Minimal `apps/api` transport/auth composition, `apps/worker` outbox
  dispatcher, and client bundle-probe fixture required to execute the
  foundation protocols; no product UI.
- CI workflows, Docker Compose, root monorepo config, per-package `AGENTS.md`.

Everything else (other domain modules, mobile app features) is out of scope —
stop and report if a task seems to require it.

## Process

1. Work from the foundation specs in `docs/specs/` (`core`, `db`,
   `contract`, security/operations including auth, money, payment/feature-flag
   skeletons, reference-slice boundaries), plus the ownership map and
   relevant completed v1 migration-matrix slices. **Active** specs
   (`db`, `companies-foundation`, `money`, `feature-flags`) are contracts —
   patch them in this PR only when a test proves a gap. **Living**
   foundation specs may be amended in the same PR. Unresolved product
   decisions still stop the task. Accepted ADR-0016 is mandatory for all
   action/contract package work.
2. **Merge one foundation PR at a time.** You may prepare the next
   non-conflicting task on another branch while a PR is in review.
   Dependency order still holds (tooling/CI → db/auth → companies/RBAC
   and prerequisite schemas → core → contract → api/worker → reference
   slices). ~300 lines is review comfort — do not split a coherent slice
   only to hit the number. Sensitive and first-core PRs get full human
   review; mechanical scaffold PRs get CI + a human skim.
3. Tests required for the foundation invariants (blueprint §2.1) that
   later modules inherit: the cross-tenant harness is parameterized over
   all principal modes (ADR-0013). Red-then-green is not required for
   schema or config.
4. The reference slices are the templates every later agent copies —
   over-invest in clarity: file layout, naming, error style, test style,
   comments explaining non-obvious intent.

## Exit gates (phase 0–1 done when)

- `tsc`, ESLint boundaries, Vitest (unit + Testcontainers integration), and
  the contract check are green in CI, with branch protection enabled.
- Foundation invariant test suites pass: tenant isolation (all principal
  modes), idempotency protocol, money snapshot immutability, audit records,
  projection ownership.
- An agent can add a new action from the reference template and reach green
  CI without touching `packages/core`.
- Both reference slices exist: `pricing` (pure/query patterns) and the thin
  order → outbox → chat card projection (write/event/idempotency patterns).
