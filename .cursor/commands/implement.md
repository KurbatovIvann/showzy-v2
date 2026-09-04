# Implement a Linear issue

Dispatch once, then stop. Do not recurse.

1. Fetch the issue (include relations and labels).
2. **Parent feature** — it has child issues, or label `Feature`:
   follow `.cursor/commands/conveyor.md` only. Do **not** continue this
   file. Do not implement children.
3. **Leaf ticket** — if the user invoked `/implement` on a leaf, follow
   `.cursor/commands/ticket.md` (it uses the executor section below and
   must **not** re-enter this dispatch). If you are already in
   `ticket.md` step IMPLEMENT, continue with Setup.

If Dispatch classified this as a Feature parent, stop here.

---

# Implement one feature ticket (leaf)

You are an **Executor** for Showzy 2.0 (ADR-0023). The user names a Linear
ticket (or a module + task id). You implement exactly that ticket —
nothing more. You do not write `docs/specs/` or `docs/plans/`.

## Setup

1. Fetch the Linear ticket and its parent feature card. That card plus
   any `*.contract.ts` already on the branch (or on `main`) is the
   contract. Do not open `docs/archive/`. For v1 columns use
   `docs/reference/`.
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
   this layer**. Copy **protocol** (tenant, pagination helpers, errors,
   permissions, folders). Do not copy a screen-shaped list/write input
   that ADR-0033 retires. Staff lists copy `orders.list` (SHO-351). Do
   not invent folders, layers, or dependencies. Mobile
   tickets: load `.cursor/skills/showzy-mobile/SKILL.md` before writing
   `apps/mobile` code. Web product-screen tickets: follow
   `.cursor/rules/web-panel-port.mdc` and
   `docs/design/mapping/mp-to-web.md` — MCP-read the web canvas Screens
   entry and component files before writing JSX. If MCP fails, stop.
5. Work on the Linear ticket's `gitBranchName` when present; otherwise
   `feat/sho-<number>-<slug>`. Linear names are not `cursor/` — when
   opening the PR, set `skip_branch_prefix_check: true`.

## Process

1. **Tests required** (`.cursor/rules/definition-of-done.mdc`). For
   new/changed actions, cover the five action classes. Write them first
   when it clarifies the contract; shipping them with the code is fine.
   They must fail if the behavior is removed. For schema, config, tooling,
   or migrations, prove the change — do not stage a red-then-green ritual.
   Schema columns freeze when this schema PR merges.
2. **Implement** until tests pass. Follow the golden slice for **runtime
   protocol**. List/write *jobs* follow ADR-0033 and the feature card —
   not “copy `catalog.listProducts` input forever.” Do not invent
   folders, layers, or dependencies.
3. **Verify loop** — run the checks CI will run for this change. Repeat
   until green. Two failed rounds → stop and ask the human. Runtime/DB
   work needs Vitest + contract + migration suite.
   Mechanical edits may use the relevant package filter; CI still has to
   be green.
4. **Open a draft PR** titled `SHO-<n> <title>` whose description states:
   the Linear ticket / feature card, tests written, and any deviations
   (there should be none — deviations mean you should have stopped).
   Do not merge. A parent conveyor (ADR-0029) or a human merges.

## Hard boundaries

- Never touch `packages/core`. Do not touch another module unless the
  **feature card names** that supporting action (ADR-0015 callees such as
  `customers.listMatchingIds`). Unnamed foreign-module work is a stop.
- Tenant scope comes from the verified principal context; an input
  company/resource identifier is only a selector. No raw SQL. No `any`.
- Tenant scope, output validation, idempotency, confirmation, events, and
  audit implied by action metadata must be implemented and tested, not
  just declared.
- If you cannot finish within the ticket scope, report what blocks you
  instead of expanding the scope.
