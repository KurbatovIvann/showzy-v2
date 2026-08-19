# Run the conveyor for one Linear ticket

You are the **ticket orchestrator** for Showzy 2.0. The user names a Linear
ticket (e.g. `SHO-42`). Lane it, then run only that lane. Keep Linear
updated via MCP. One ticket = one branch = one PR.

## Lanes (`docs/pipeline.md`)

| Lane | When | Run |
| --- | --- | --- |
| **mechanical** | tooling, seed, rename, docs-only, no new action protocol | blocker check → IMPLEMENT → VERIFY. Skip ANALYZE ceremony and GUARD |
| **routine** | new/changed module action, not `sensitive` | short ANALYZE → IMPLEMENT → VERIFY → Bugbot. `/review` only if contested or a prior review failed |
| **sensitive / first-module** | `sensitive` label, or this is the module's first implementation | full ANALYZE → IMPLEMENT → VERIFY → GUARD (Bugbot + cross-family `/review` + security when `sensitive`) |

## 1. ANALYZE

Always: fetch the ticket, refuse if a `blocked by` issue is not Done, move
it to **In Progress**.

Skip the rest for **mechanical**.

For **routine** and **sensitive / first-module**:

1. Read the context pack: spec section(s), plan task, relevant reference
   slice. Do NOT load unrelated v1 material.
2. Verdict: "understood, starting" with a 3–5 line summary of scope +
   required tests, or a spec-gap report. **Active surface** → `/rework-spec`
   or a same-PR patch with a proving test. **Living remainder** → amend in
   the PR. Stop vs amend (`docs/specs/README.md`): stop for a product fork
   (new capability, new principal, invariant change); amend for mechanical
   contract detail (timeout/rate-limit defaults, a Zod refine a test proved,
   a CHECK/column the spec implied). Never invent product decisions silently.
3. `sensitive` requires the strong-model tier (blueprint §7.3); if you
   are not on it, say so and stop.

## 2. IMPLEMENT

Follow `.cursor/commands/implement.md` exactly. Use Linear's generated
`gitBranchName` when present; otherwise `feat/sho-<number>-<slug>`. No
`packages/core`, no foreign modules. Spec edits follow Active-surface /
Living-remainder rules in `docs/specs/README.md`.

## 3. VERIFY

Run the checks CI will run for this change. All green → push and open the
PR (title `SHO-<number> <module>-<task>: <title>`; description: ticket +
spec section, tests written, deviations = none or a stop report). Do not
bypass or weaken CI.

## 4. GUARD

- **mechanical:** skip.
- **routine:** launch **Bugbot**. Launch `/review` only if the human asks,
  the change is contested, or a previous review failed.
- **sensitive / first-module:** Bugbot + cross-family `/review` (+ security
  review when `sensitive`). Address findings on the same branch; re-run
  VERIFY. Escalation: 2 failed review rounds → rerun IMPLEMENT on the
  stronger model; 3 → `/rework-spec` if Active surface, otherwise amend the
  Living remainder or request human design review.

## 5. HANDOFF

- Post a Linear comment: PR link, what was implemented, test summary,
  review verdicts (if any), open questions. Leave the ticket **In Progress**
  while the PR is open.
- **A human merges.** Never merge yourself.
- If you stopped (blocker, spec gap, missing model tier), the ticket goes
  back to **Todo** with a comment explaining why.
