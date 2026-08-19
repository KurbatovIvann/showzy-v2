# Implement one task from a Living, Mixed, or Active spec

You are an **implementation agent** for Showzy 2.0. The user names a module
and a task ID from `docs/plans/<module>.md` (normally also a Linear ticket).
You implement exactly that task — nothing more.

## Setup

1. Read `docs/specs/<module>.md` and its `Status` / `Active surface` lines
   (`docs/specs/README.md`). **Active surface:** follow it; if it is
   ambiguous or wrong, stop and report, or patch it in this PR with a test
   that proves the gap. **Living remainder:** follow the named slice; you may
   amend the spec in this PR when implementation discovers a gap.
2. Stop vs amend (`docs/specs/README.md`):
   - **Stop and ask** — new capability, new principal, change to an invariant,
     “should this exist at all”, adding a table the slice did not name.
   - **Amend in the same PR, mention in the description** — timeout/rate-limit
     defaults, a Zod refine a test proved, a CHECK/column implied by the spec,
     a missing metadata field `defineActionContract` requires.
3. Read `.cursor/rules/` (conventions, prohibitions, definition of done) —
   these are enforced in review.
4. Read the named task and context pack in `docs/plans/<module>.md`, then
   study the relevant reference slice: pricing for query/`ctx.call`, or the
   thin order→chat slice for writes/idempotency/events/projections.
5. Work on the Linear ticket's branch name when available; otherwise use
   `feat/<module>-<task-id>`.

## Process

1. **Tests required** (see `.cursor/rules/definition-of-done.mdc`). For
   new/changed actions, cover the five action classes. Write them first
   when it clarifies the contract; shipping them with the code is fine.
   They must fail if the behavior is removed. For schema, config, tooling,
   or migrations, prove the change — do not stage a red-then-green ritual.
   Schema columns freeze when this schema PR merges — the owner is reviewing
   irreversible columns here, not in a separate spec-freeze ceremony.
2. **Implement** until tests pass. Follow the relevant reference slice; do
   not invent new patterns, abstractions, or dependencies.
3. **Verify locally** the checks CI will run for this change. Runtime/DB
   work needs the full Vitest + contract + migration suite. Mechanical
   edits may use the relevant package filter; CI still has to be green.
4. **Open a PR** titled `<module>-<task-id>: <title>` whose description
   states: the Linear ticket, spec section implemented, tests written, and
   any deviations or open questions (there should be none — deviations mean
   you should have stopped and reported).

## Hard boundaries

- Never touch `packages/core` or other modules' code. Spec edits follow the
  Active-surface / Living-remainder rule above. `/rework-spec` is
  Active-surface only.
- Tenant scope must come from the verified principal context; an input
  company/resource identifier is only a selector. No raw SQL. No `any`.
- Tenant scope, output validation, idempotency, confirmation, events, and
  audit implied by action metadata must be implemented and tested, not just
  declared.
- If you cannot finish within the task scope, report what blocks you instead
  of expanding the scope.
