# Run the conveyor for one Linear ticket

You are the **ticket orchestrator** (Executor) for Showzy 2.0 (ADR-0023).
The user names a Linear ticket (e.g. `SHO-42`).

If that issue has children or the `Feature` label, stop and follow
`.cursor/commands/conveyor.md` (parent orchestrator). Do not implement
the feature as one branch.

Otherwise: lane it, then run only that lane. Keep Linear updated via MCP.
One ticket = one branch = one PR.

## Lanes (`docs/pipeline.md`)

| Lane | When | Run |
| --- | --- | --- |
| **mechanical** | tooling, seed, rename, docs-only, no new action protocol | blocker check → IMPLEMENT → VERIFY. Skip ANALYZE ceremony and GUARD |
| **routine** | new/changed module action, not `sensitive` | short ANALYZE → IMPLEMENT → VERIFY → Bugbot. `/review` only if contested or a prior review failed |
| **sensitive / first-slice** | `sensitive` label, or this is the golden backend/UI slice | full ANALYZE → IMPLEMENT → VERIFY → GUARD (Bugbot + `/review` + `/guard` when `sensitive` or first slice) |

## 1. ANALYZE

Always: fetch the ticket, refuse if a `blocked by` issue is not Done, move
it to **In Progress**.

Skip the rest for **mechanical**.

For **routine** and **sensitive / first-slice**:

1. Read the context pack: feature card, golden files for this layer.
   Do NOT load unrelated v1 material or archived spec novels.
2. Verdict: "understood, starting" with a 3–5 line summary of scope +
   required tests, or a stop report. Stop for a product fork (new
   capability, new principal, invariant change, new table). Amend
   mechanical contract detail in the PR. Never invent product decisions.

## 2. IMPLEMENT

Follow **Setup**, **Process**, and **Hard boundaries** in
`.cursor/commands/implement.md`. Skip that file’s Dispatch section
(you already decided this is a leaf). Use Linear's generated
`gitBranchName` when present; otherwise
`feat/sho-<number>-<slug>`. No `packages/core`, no foreign modules, no
`docs/specs/` novels.

## 3. VERIFY

Run the checks CI will run for this change. All green → push and open a
**draft** PR (title `SHO-<number> <title>`; description: ticket + feature
card, tests written, deviations = none or a stop report;
`skip_branch_prefix_check: true` when the branch is Linear
`gitBranchName`). Do not mark the PR ready. Do not bypass or weaken CI.
Two failed verify rounds → stop and ask the human.

Comment Linear with the PR URL as soon as the PR exists. Move the ticket
to **In Review**. Do not leave it In Progress (SHO-184 did; that was
wrong).

## 4. GUARD

Cloud executors often **cannot** launch nested Task `bugbot`, isolated
`/review`, or `security-review` (ADR-0029, SHO-197). That is expected.
Do not fail the ticket. Do not wait. Apply `.cursor/commands/review.md`
and `.cursor/commands/guard.md` in-process as a **self-check**, report
those verdicts on Linear as self-check (writer = this agent), and leave
independent reviews to the parent conveyor or the human.

When those Task tools **are** available in this conversation (interactive
`/ticket`, not a nested cloud child):

- **mechanical:** skip.
- **routine:** launch **Bugbot**. Launch `/review` only if the human asks,
  the change is contested, or a previous review failed.
- **sensitive / first-slice:** Bugbot + `/review` + `/guard`
  (security when `sensitive`). Address findings on the same branch;
  re-run VERIFY. Escalation: 2 failed review rounds → ask the human;
  3 → design review or a new ADR.

## 5. HANDOFF

- Post a Linear comment: PR link, what was implemented, test summary,
  self-check verdicts (if any), open questions. Ticket stays **In Review**
  while the PR is open. Do not mark Ready; the parent or a human does.
- **Do not merge.** The parent conveyor squash-merges when the merge gate
  is green (ADR-0029). A human merges a leaf `/ticket` that is not under
  a parent conveyor.
- If you stopped (blocker, product fork), the ticket
  goes back to **Todo** with a comment explaining why.
