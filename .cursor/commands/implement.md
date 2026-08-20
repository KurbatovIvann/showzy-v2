# Implement one feature ticket

You are an **Executor** for Showzy 2.0 (ADR-0023). The user names a Linear
ticket (or a module + task id). You implement exactly that ticket —
nothing more. You do not write `docs/specs/` or `docs/plans/`.

## Setup

1. Fetch the Linear ticket and its parent feature card. That card plus
   any `*.contract.ts` already on the branch (or on `main`) is the
   contract. Archived files in `docs/archive/specs/` are research only.
2. Stop vs amend:
   - **Stop and ask** — new capability, new principal, change to an
     invariant, “should this exist at all”, adding a table the card did
     not name, contradicting an ADR.
   - **Amend in the same PR, mention in the description** — timeout /
     rate-limit defaults, a Zod refine a test proved, a CHECK/column the
     card implied, a missing metadata field `defineActionContract`
     requires.
3. Read `.cursor/rules/` (conventions, prohibitions, definition of done).
4. Read only the context pack on the ticket. Study the **golden files for
   this layer**. Copy their shape. Do not invent folders, layers, or
   dependencies.
5. Work on the Linear ticket's branch name when available; otherwise
   `feat/sho-<number>-<slug>`.

## Process

1. **Tests required** (`.cursor/rules/definition-of-done.mdc`). For
   new/changed actions, cover the five action classes. Write them first
   when it clarifies the contract; shipping them with the code is fine.
   They must fail if the behavior is removed. For schema, config, tooling,
   or migrations, prove the change — do not stage a red-then-green ritual.
   Schema columns freeze when this schema PR merges.
2. **Implement** until tests pass. Follow the golden slice. Do not invent
   new patterns, abstractions, or dependencies.
3. **Verify loop** — run the checks CI will run for this change. Repeat
   until green. Two failed rounds → stop and say a stronger model is
   needed. Runtime/DB work needs Vitest + contract + migration suite.
   Mechanical edits may use the relevant package filter; CI still has to
   be green.
4. **Open a PR** titled `SHO-<n> <title>` whose description states: the
   Linear ticket / feature card, tests written, and any deviations (there
   should be none — deviations mean you should have stopped).

## Hard boundaries

- Never touch `packages/core` or other modules' code.
- Tenant scope comes from the verified principal context; an input
  company/resource identifier is only a selector. No raw SQL. No `any`.
- Tenant scope, output validation, idempotency, confirmation, events, and
  audit implied by action metadata must be implemented and tested, not
  just declared.
- If you cannot finish within the ticket scope, report what blocks you
  instead of expanding the scope.
