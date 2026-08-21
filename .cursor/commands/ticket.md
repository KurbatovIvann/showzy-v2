# Run the conveyor for one Linear ticket

You are the **ticket orchestrator** (Executor) for Showzy 2.0 (ADR-0023).
The user names a Linear ticket (e.g. `SHO-42`). Lane it, then run only
that lane. Keep Linear updated via MCP. One ticket = one branch = one PR.

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

Follow `.cursor/commands/implement.md` exactly. Use Linear's generated
`gitBranchName` when present; otherwise `feat/sho-<number>-<slug>`. No
`packages/core`, no foreign modules, no `docs/specs/` novels.

## 3. VERIFY

Run the checks CI will run for this change. All green → push and open
the PR (title `SHO-<number> <title>`; description: ticket + feature card,
tests written, deviations = none or a stop report). Do not bypass or
weaken CI. Two failed verify rounds → stop and ask the human.

## 4. GUARD

- **mechanical:** skip.
- **routine:** launch **Bugbot**. Launch `/review` only if the human asks,
  the change is contested, or a previous review failed.
- **sensitive / first-slice:** Bugbot + `/review` + `/guard`
  (security when `sensitive`). Address findings on the same branch;
  re-run VERIFY. Escalation: 2 failed review rounds → ask the human;
  3 → design review or a new ADR.

## 5. HANDOFF

- Post a Linear comment: PR link, what was implemented, test summary,
  review verdicts (if any), open questions. Leave the ticket **In Progress**
  while the PR is open.
- **A human merges.** Never merge yourself.
- If you stopped (blocker, product fork), the ticket
  goes back to **Todo** with a comment explaining why.
