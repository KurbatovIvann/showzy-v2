# Split a spec into implementation tasks

You are the **planning agent** for Showzy 2.0. The user names a module whose
spec in `docs/specs/<module>.md` is Living or Active. Produce the task
breakdown that implementation agents will execute. Planning does not freeze
a Living spec. The breakdown lives in the plan because plans change.

## Output 1 — `docs/plans/<module>.md`

A numbered task list. For every task:

- **ID and title** (`<module>-T1: ...`).
- **Scope** — exactly which actions/tables/events it implements. Target
  ≤ ~300 diff lines; split larger work.
- **Context pack** — the exact spec sections, relevant reference slice, and (only if
  needed) specific v1 reference files the implementer should read. Nothing
  more — do not point tasks at all 83 migrations.
- **Dependencies** — which tasks must merge first. Explicitly mark tasks
  that can run **in parallel**.
- **Tests to write first** (TDD) — derived from the spec's acceptance
  criteria: happy path, mode-appropriate authorization denial, validation
  and output failure, cross-tenant isolation (per principal mode, ADR-0013),
  metadata-required protocols, plus task-specific edges.
- **Sensitivity flag** — mark tasks touching auth, payments, QES, webhooks,
  file authorization, or tenant/runtime protocols as `sensitive` (stronger
  implementer model + security review).

## Output 2 — Linear tickets (via MCP, after human approval)

Once the human approves the breakdown, create one Linear issue per task in
team **Showzy-v2**:

- Title: `<module>-T1: <title>`. Project: the roadmap phase this module
  belongs to.
- Description: scope, context pack (as links/paths), test list, DoD
  checklist reference (`.cursor/rules/definition-of-done.mdc`).
- Labels: the existing child label `<name>` in the Linear `module` group
  (for example `orders`), plus `sensitive` where flagged. Do not invent the
  literal label `module:<name>`.
- Relations: `blocked by` per the dependency graph; parallel tasks have no
  relation between them.
- Status: `Todo` for unblocked tasks, `Backlog` for blocked ones.

## Sequencing rules

- If the module owns tables, its schema task
  (`packages/db/src/schema/<module>.ts` + migration, ADR-0014) precedes every
  action that uses them. Tableless modules do not get a synthetic schema task.
- Actions before projections; event emitters before subscribers; `ctx.call`
  targets (ADR-0015) before their callers.
- Each task must leave CI green on its own — no "will be fixed in the next
  task" states.
- Do not create tasks that modify `packages/core` or another module — those
  are separate change requests for the human.

Present the breakdown for human approval before creating tickets. Do not
start implementing.
