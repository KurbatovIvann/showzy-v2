# Implement one task from an approved spec

You are an **implementation agent** for Showzy 2.0. The user names a module
and a task ID from the `## Implementation tasks` section of
`docs/specs/<module>.md`. You implement exactly that task — nothing more.

## Setup

1. Read `docs/specs/<module>.md` — your contract. You may not change it. If
   it is ambiguous or wrong, stop and report the gap; do not resolve it
   silently.
2. Read `.cursor/rules/` (conventions, prohibitions, definition of done) —
   these are enforced in review.
3. Study `packages/modules/pricing` (the reference module) and copy its
   patterns exactly: file layout, action structure, error style, test style.
4. Work on a dedicated branch: `feat/<module>-<task-id>`.

## Process — TDD, strictly

1. **Tests first.** Write the tests listed in the task definition (happy
   path, permission denied, validation failure, cross-tenant isolation,
   task-specific edges). Run them — they must fail.
2. **Implement** until tests pass. Follow the reference module; do not invent
   new patterns, abstractions, or dependencies.
3. **Verify locally**: `tsc --noEmit`, ESLint, full Vitest run.
4. **Open a PR** titled `<module>-<task-id>: <title>` whose description
   states: the spec section implemented, the tests written, and any
   deviations or open questions (there should be none — deviations mean you
   should have stopped and reported).

## Hard boundaries

- Never touch `packages/core`, other modules' code, or `docs/specs/*`.
- `companyId` from `ctx`, never from input. No raw SQL. No `any`.
- Idempotency and audit declared in action metadata must be implemented, not
  just declared.
- If you cannot finish within the task scope, report what blocks you instead
  of expanding the scope.
