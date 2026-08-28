# Run the autonomous conveyor for one feature parent

You are the **parent orchestrator** for Showzy 2.0 (ADR-0023, ADR-0029).
The user names a Linear **feature parent** (e.g. `/implement SHO-191` or
`/ticket SHO-191` when that issue has children or the `Feature` label).

You do **not** implement child tickets. You launch one isolated cloud
`/ticket` executor per child, attach independent reviews, and squash-merge
when the merge gate is green.

This playbook is the SHO-183 staff price-lists run, written down.

## When this command runs

- The named issue is a feature card with child tickets, or label `Feature`.
- The card is already approved and tickets exist (`/feature` already ran).
- You have Linear MCP, GitHub MCP `merge_pull_request`, Cursor Task
  (`environment: cloud` for children; `bugbot` / `security-review` /
  isolated `/review` from **this** conversation).

If the named issue is a leaf ticket, stop and follow
`.cursor/commands/ticket.md` instead.

## Isolation

- One **cloud** Task executor per child (`environment: cloud`,
  `cloud_base_branch: main`, `run_in_background: true`).
- **Sequential** when children share files (same module under
  `packages/modules/<name>/`, or the same `apps/mobile/src/features/<name>/`,
  or the same i18n namespace). SHO-183 pricing backend + mobile list/editor
  had to be sequential.
- **Parallel** only when Linear `blocked by` is empty **and** the tickets
  cannot touch the same paths.
- The parent never edits product code on a child branch.

## Queue

1. Fetch the parent and every child (`blocked by`, labels, `gitBranchName`).
2. Skip Done / Canceled. Do not work process-gap children that are docs-only
   unless that *is* the named parent.
3. Ready = Todo (or Backlog whose blockers are all Done).
4. Persist short orchestrator state (current child, PR, SHAs, review
   agent ids). Do not invent a second work ledger besides Linear.

## Child executor prompt (required)

Each cloud child must:

- Follow `.cursor/commands/ticket.md` and `.cursor/commands/implement.md`.
- Use Linear `gitBranchName`. Open a **draft** PR with
  `skip_branch_prefix_check: true` (Linear branches are not `cursor/`).
- PR title: `SHO-<n> <ticket title>`.
- **Not merge.**
- Not fail the ticket because nested Task `bugbot` / `/review` /
  `security-review` are unavailable (ADR-0029). Apply `review.md` /
  `guard.md` in-process as a **self-check** and say so on Linear. Parent
  attaches the independent reviews.
- Load `.cursor/skills/showzy-mobile/SKILL.md` before `apps/mobile`.
- VERIFY locally (the CI-equivalent checks for that change). Comment
  evidence on Linear. Move the child to **In Review** when the PR is open.
  Do not mark the child Done.

## After the child PR opens (parent)

1. `git fetch` the Linear branch and check it out locally (Bugbot /
   security-review `Diff: branch changes` need that checkout).
2. Launch **independent** Task tools from this conversation (never nested
   inside the child):
   - **Bugbot** — `run_in_background: false` on routine+ and sensitive.
   - **Security Review** — `run_in_background: false` when the child is
     `sensitive` or first-slice.
   - Isolated `/review` — `run_in_background: true` on sensitive /
     first-slice, or when a prior review on this feature failed. Routine
     copy-only still gets `/review` if the parent is already in that
     habit from a failed review on an earlier child.
3. Subscribe to GitHub CI on the Linear branch. Subscribe to Linear
   comments/status on the child. Do not poll.
4. Comment the child and the parent: PR URL, Bugbot / security verdicts,
   that `/review` may still be running.

## Merge gate (parent squash-merges)

Merge **only** when all of these hold:

1. The seven GitHub Actions jobs on the head SHA succeeded:
   `checks`, `secret-scan`, `dependency-audit`, `contract-check`,
   `migration-drift`, `bundle-probe`, `e2e-smoke`.
2. Independent Task Bugbot (if launched): no bugs.
3. Independent Task security-review (if launched): no medium / high /
   critical.

Not merge blockers (seen on SHO-183):

- GitHub-hosted Cursor Bugbot check `neutral` or “usage limit reached”.
  The parent Task Bugbot is the independent Bugbot.
- GitHub “Cursor Security Reviewer” missing or still pending. The parent
  Task security-review is the independent guard.
- Isolated `/review` still running. It often finishes **after** merge.

Then: mark the draft PR ready, squash-merge via GitHub MCP
`merge_pull_request`, set the child **Done**, pull `main`, launch the
next child.

Linear GitHub sync may flip the child to **In Progress** when the PR
becomes ready. After merge, re-read the issue; if it is not Done, set
Done again.

## Independent `/review` after merge

- **APPROVE** or nits → Linear comment only. Do not reopen the Done child.
  Do not implement nits as required follow-ups.
- **REQUEST CHANGES** with blockers or majors → new Linear child under the
  same parent. Do not reopen the Done ticket. Put the follow-up on the
  queue (sequential if it shares files with remaining work).

## Parent ticket

Leave the feature parent **In Progress**. A human closes it after they
have used the product (or explicitly ask you to mark it Done).

When the named queue and review follow-ups are on `main`, comment the
parent with the merge SHAs and stop launching children.

## Stop conditions

Same as `/ticket`: product fork, missing golden, two failed verify rounds
on a child, ADR contradiction. Comment the parent, leave remaining
children in Todo / Backlog, do not grind.

## SHO-197 (expected)

Cloud `/ticket` executors cannot launch nested Task Bugbot, isolated
`/review`, or `security-review`. That is a Cursor nesting limit, not a
pricing (or any module) bug. **Writer ≠ reviewer** is this parent’s job:
independent Task tools in the orchestrator conversation. Do not wait for
nested Task to start the conveyor. Do not fail a child because those
tools were unavailable in the executor.
