# Run the conveyor for one Linear ticket

You are the **ticket orchestrator** for Showzy 2.0. The user names a Linear
ticket (e.g. `SHW-42`). You take it through the full conveyor:
ANALYZE → IMPLEMENT → VERIFY → GUARD, and keep Linear updated via MCP at
every transition. One ticket = one branch = one PR.

## 1. ANALYZE (gate — do not write code yet)

1. Fetch the ticket from Linear (MCP). Read its description, labels, and
   relations.
2. **Check blockers**: every `blocked by` ticket must be Done. If not, stop
   and report which ones block.
3. Read the context pack referenced by the ticket: the spec section(s) in
   `docs/specs/<module>.md`, the task entry in `docs/plans/<module>.md`, the
   relevant reference slice. Do NOT load unrelated v1 material.
4. Verdict to the user: either "understood, starting" with a 3–5 line summary
   of scope + test list, or targeted questions / a spec-gap report
   (→ `/rework-spec`). Spec gaps stop the conveyor — never resolve them
   silently.
5. On start: move the ticket to **In Progress**, assign yourself if possible.

## 2. IMPLEMENT

Follow `.cursor/commands/implement.md` exactly. Use Linear's generated
`gitBranchName` when present (it already contains the issue identifier needed
by GitHub integration); otherwise use `feat/shw-<number>-<slug>`. Hard
boundaries apply: no
`packages/core`, no foreign modules, no spec edits.

If the ticket carries the `sensitive` label, you must be running on the
strong-model tier (blueprint §7.3); if you are not, say so and stop.

## 3. VERIFY

`tsc --noEmit` → ESLint → full Vitest → contract check → migration/schema
checks → phase-appropriate smoke locally. All green → push and open the PR
(title `SHW-<number> <module>-<task>: <title>`; description: ticket + spec
section implemented, tests written, deviations = none or a stop report). CI
repeats the same checks — do not bypass or weaken either.

## 4. GUARD

1. Launch **Bugbot** on the PR.
2. Launch the **cross-family review** (`/review`) — a reviewer from a
   different model family than the implementer (blueprint §7.3).
3. `sensitive` label → additionally launch the **security review**.
4. Address findings on the same branch; re-run VERIFY after changes.
   Escalation rules (pipeline): 2 failed review rounds → rerun IMPLEMENT on
   the stronger model; 3 → reopen the spec via `/rework-spec` or request
   human design review.

## 5. HANDOFF

- Post a Linear comment: PR link, what was implemented, test summary, review
  verdicts, open questions. The current Showzy-v2 workflow has no
  `In Review` state, so leave it **In Progress** while the linked PR is under
  review.
- **A human merges.** Never merge yourself. After merge, Linear's GitHub
  integration moves the ticket to Done (or note that the human should).
- If you stopped anywhere (blocker, spec gap, missing model tier), the
  ticket goes back to **Todo** with a comment explaining why.
