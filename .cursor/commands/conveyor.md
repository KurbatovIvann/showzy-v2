# Run the autonomous conveyor for one feature parent

You are the **parent orchestrator** for Showzy 2.0 (ADR-0023, ADR-0029).
The user names a Linear **feature parent** (e.g. `/implement SHO-191` or
`/ticket SHO-191` when that issue has children or the `Feature` label).

You do **not** implement child tickets. You do **not** edit product code
on a child branch. You launch one isolated cloud `/ticket` executor per
child, attach independent reviews from **this** conversation, and
squash-merge when the merge gate is green.

This playbook is the SHO-183 staff price-lists run, written down.

## When this command runs

- The named issue has child tickets, or label `Feature`.
- The card is already approved and tickets exist (`/feature` already ran).
- You have Linear MCP, GitHub MCP `merge_pull_request`, and Cursor Task
  (`environment: cloud` for children; `bugbot` / `security-review` /
  isolated `/review` from **this** conversation).

If the named issue is a leaf, stop and follow
`.cursor/commands/ticket.md` instead.

## Isolation

- One **cloud** Task executor per child (`subagent_type: generalPurpose`,
  `environment: cloud`, `run_in_background: true`).
- **Default sequential** for one feature. Linear `blocked by` is not
  enough: SHO-184, SHO-186, and SHO-185 were all Todo at once, and all
  would have conflicted on `packages/modules/pricing` (and usually
  `index.ts` / `index.contract.ts`).
- Same module (`packages/modules/<name>/`), same schema file, same
  `apps/mobile/src/features/<name>/`, or the same i18n namespace →
  sequential. Never parallel.
- **Parallel** only when you can name **disjoint path sets** and Linear
  `blocked by` is empty. When unsure, sequential.
- First implementation: `cloud_base_branch: main`. After a squash-merge,
  wait until `origin/main` contains the merge SHA before the next child.
- Fix on an open PR: `cloud_base_branch` = that PR’s head branch (the
  Linear `gitBranchName`). Prompt: do not open a new PR; push to the
  existing branch.

## Queue

1. Fetch the parent and every child (`blocked by`, labels, `gitBranchName`).
2. Skip Done / Canceled.
3. Skip **process-gap / docs-only siblings** (e.g. Improvement with no
   module label, like SHO-197) unless that issue **is** the named parent.
4. Ready = Todo (or Backlog whose blockers are all Done).
5. Order: topological by `blocked by`, then sequential among overlapping
   files. SHO-183 order after that rule: 184 → 186 → 185 → 188 → 187 →
   189 → 190, then review follow-ups 198 → 199 → 200.
6. Persist short state (current child, PR, SHAs, review agent ids) in the
   agent store if you have one. Linear comments are the ledger. Do not
   invent a second tracker.

Stay on `main` except a temporary checkout of the child branch for
Bugbot / security-review (`Diff: branch changes`). Do not commit on a
child branch. Do not open a product PR from this conversation.

## Launch one child

Comment the child: executor starting, parent will merge on the gate.

Launch Task with a **complete** prompt (do not invent a weaker one):

- Follow `.cursor/commands/ticket.md`. In IMPLEMENT, follow
  `.cursor/commands/implement.md` but **skip that file’s Dispatch**
  (this is a leaf).
- Ticket id, parent feature id, Linear `gitBranchName`. Use that branch
  even if a cloud default wants `cursor/` — set
  `skip_branch_prefix_check: true` on the PR.
- PR title `SHO-<n> <ticket title>`. **Draft.** Do not mark ready. **Do
  not merge. Do not mark the ticket Done.**
- Nested Task `bugbot` / isolated `/review` / `security-review` will
  fail (SHO-197). That is expected. Do not fail the ticket. Self-check
  `review.md` / `guard.md` and say so on Linear.
- Comment Linear with the PR URL **as soon as the PR exists.** Move the
  ticket to **In Review**.
- Load `.cursor/skills/showzy-mobile/SKILL.md` before `apps/mobile`.
- VERIFY locally (the CI-equivalent checks for that change).

Then subscribe to Linear comments/status on the child. **End the turn.**
Do not poll Task. Do not implement while the child runs.

## After the child PR exists (parent)

Find the PR from the Linear comment, or GitHub search `SHO-<n>`. If the
child stopped (product fork, two failed VERIFY rounds), comment the
parent and halt — do not grind.

1. `git fetch` the Linear branch and check it out (Bugbot /
   security-review `Diff: branch changes` need that checkout).
2. Launch **independent** Task tools from this conversation (never
   nested inside the child):

   - **Bugbot** — `subagent_type: bugbot`, `run_in_background: false`,
     prompt:
     `Full Repository Path: <repo>`
     `Diff: branch changes`
     plus any custom instructions. Routine+ and sensitive.
   - **Security Review** — `subagent_type: security-review`,
     `run_in_background: false`, same prompt shape, when the child is
     `sensitive`, first-slice, or tenant money / auth / confirmation.
   - Isolated `/review` — `subagent_type: generalPurpose`,
     `run_in_background: true` (so it runs in parallel with CI), follow
     `.cursor/commands/review.md` on that PR. Launch when the lane
     requires it: `sensitive`, first-slice, **UI** (`apps/mobile`), or a
     prior `/review` on this feature was REQUEST CHANGES. Do **not**
     launch on mechanical or ordinary routine backend. **If you launch
     it, it is a merge gate** — do not merge while it is still running.

3. Subscribe to GitHub CI on the Linear branch. Do not poll.
4. Comment the child and the parent: PR URL, Bugbot / security verdicts,
   and that merge waits on `/review` when it was launched.
5. If CI or `/review` is still pending, **end the turn** and continue
   when that notification arrives. Merge only when CI is green and, if
   `/review` was launched, its verdict is in.

If Bugbot reports bugs, security-review reports medium+, Actions is
red, or `/review` is **REQUEST CHANGES** with blockers/majors: **do not
merge and do not fix it yourself.** Comment Linear. Launch a new cloud
executor on the **same** branch (`cloud_base_branch` = PR head) with the
findings. After it pushes, re-run VERIFY-equivalent wait and **re-launch
`/review`**. Two failed review rounds → ask the human. End the turn.

## Merge gate (parent squash-merges)

The GitHub check-run list may be longer than seven (Cursor Bugbot /
Security Reviewer extras). Gate on these **Actions job names** only:

`checks`, `secret-scan`, `dependency-audit`, `contract-check`,
`migration-drift`, `bundle-probe`, `e2e-smoke`.

Merge **only** when all of these hold:

1. Those seven jobs succeeded on the head SHA.
2. Independent Task Bugbot (if launched): no bugs.
3. Independent Task security-review (if launched): no medium / high /
   critical.
4. Isolated `/review` **if launched**: verdict is in, and it is
   **APPROVE** or nits-only. REQUEST CHANGES with blockers/majors is
   not a merge — same-branch fix (above). Do not merge while `/review`
   is still running.

`/review` nits are Linear comments. They do not block merge and they
do not become tickets.

Not merge blockers:

- GitHub-hosted Cursor Bugbot check `neutral` or “usage limit reached”.
  The parent Task Bugbot is the independent Bugbot.
- GitHub “Cursor Security Reviewer” missing or still pending. The parent
  Task security-review is the independent guard.

Then: mark the draft PR ready (`ManagePullRequest` `update_pr` with
`draft: false` and `branch_name`), squash-merge via GitHub MCP
`merge_pull_request` (`merge_method: squash`). Do not use `gh` for
writes. Set the child **Done**. `git fetch origin main` and confirm the
merge SHA is on `origin/main`. Checkout `main`. Launch the next child.

Linear GitHub sync may flip the child to **In Progress** when the PR
becomes ready. After merge, re-read the issue; if it is not Done, set
Done again.

## Late `/review` (fallback only)

Happy path: `/review` returns **before** merge. SHO-183 sometimes
merged first; that is **not** the rule anymore.

If a launched `/review` still arrives **after** squash-merge (hung
agent, dropped notification):

- **APPROVE** or nits → Linear comment only. Do not reopen Done. Do
  not file nits as tickets.
- **REQUEST CHANGES** with blockers or majors → **new** Linear child
  under the same parent. Do not reopen the Done ticket. Put the
  follow-up on the queue (sequential if it shares files). This is how
  SHO-189 → SHO-198 happened; treat that as the backup, not the plan.

## Parent ticket

Leave the feature parent **In Progress**. A human closes it after they
have used the product (or they explicitly ask you to mark it Done).

When the named queue and review follow-ups are on `main`, comment the
parent with the merge SHAs and stop launching children.

## Stop conditions

Same as `/ticket`: product fork, missing golden, two failed verify
rounds on a child, ADR contradiction. Comment the parent, leave
remaining children in Todo / Backlog, do not grind.

## SHO-197 (expected)

Cloud `/ticket` executors cannot launch nested Task Bugbot, isolated
`/review`, or `security-review`. That is a Cursor nesting limit, not a
module bug. **Writer ≠ reviewer** is this parent’s job: independent
Task tools in the orchestrator conversation. Do not wait for nested
Task to start the conveyor. Do not fail a child because those tools
were unavailable in the executor.
