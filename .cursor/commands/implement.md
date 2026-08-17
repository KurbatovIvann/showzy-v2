# Implement one task from a Living or Active spec

You are an **implementation agent** for Showzy 2.0. The user names a module
and a task ID from `docs/plans/<module>.md` (normally also a Linear ticket).
You implement exactly that task — nothing more.

## Setup

1. Read `docs/specs/<module>.md` and its Status line (`docs/specs/README.md`).
   **Active:** follow it; if it is ambiguous or wrong, stop and report, or
   patch it in this PR with a test that proves the gap. **Living:** follow
   the named slice; you may amend the spec in this PR when implementation
   discovers a gap. Do not invent product decisions silently.
2. Read `.cursor/rules/` (conventions, prohibitions, definition of done) —
   these are enforced in review.
3. Read the named task and context pack in `docs/plans/<module>.md`, then
   study the relevant reference slice: pricing for query/`ctx.call`, or the
   thin order→chat slice for writes/idempotency/events/projections.
4. Work on the Linear ticket's branch name when available; otherwise use
   `feat/<module>-<task-id>`.

## Process — TDD, strictly

1. **Tests first.** Write the tests listed in the task definition (happy
   path, mode-appropriate authorization denial, validation failure,
   cross-tenant isolation, metadata-required protocol cases, task-specific
   edges). Run them — they must fail.
2. **Implement** until tests pass. Follow the relevant reference slice; do
   not invent new patterns, abstractions, or dependencies.
3. **Verify locally**: `tsc --noEmit`, ESLint, full Vitest, contract checks,
   migration/schema checks, and the phase-appropriate smoke test.
4. **Open a PR** titled `<module>-<task-id>: <title>` whose description
   states: the Linear ticket, spec section implemented, tests written, and
   any deviations or open questions (there should be none — deviations mean
   you should have stopped and reported).

## Hard boundaries

- Never touch `packages/core` or other modules' code. Spec edits follow the
  Living / Active rule above.
- Tenant scope must come from the verified principal context; an input
  company/resource identifier is only a selector. No raw SQL. No `any`.
- Tenant scope, output validation, idempotency, confirmation, events, and
  audit implied by action metadata must be implemented and tested, not just
  declared.
- If you cannot finish within the task scope, report what blocks you instead
  of expanding the scope.
