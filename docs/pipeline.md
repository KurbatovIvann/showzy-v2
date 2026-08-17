# Agent Pipeline — Operations Manual

How the SDD pipeline from `blueprint.md` §7 actually runs in Cursor, day to
day. The blueprint defines *what* the stages are; this document defines *how
to execute them*: which agent, which model, which command, what goes in, what
comes out, and when a stage is done.

**Key fact: there is no automatic orchestrator.** Cursor does not chain
agents by itself — the human is the conductor. Each stage = you launch an
agent (chat, background, or cloud), pick the model in the model picker, and
invoke the stage command. The commands in `.cursor/commands/` are the agents'
role instructions; this file is your checklist.

```
SPECIFICATION → PLAN → SCAFFOLD → IMPLEMENTATION → REVIEW → VERIFICATION
 (human+agent)  (agent)  (agent)   (agents in parallel)  (agents)   (CI)
```

## Stage reference

### 1. SPECIFICATION — `/spec <module>`

| | |
| --- | --- |
| Agent | One chat agent in **Plan mode**, working with you interactively |
| Model | **Claude Opus 5 (thinking, high)** or **GPT-5.6 (xhigh)** |
| Command | `/spec` with the module name |
| Input | `blueprint.md`, `scope.md`, relevant ADRs, `docs/reference/*` (v1 behavior) |
| Output | `docs/specs/<module>.md` |
| Done when | **You approve and commit the spec.** From that moment it is a contract — implementers may not change it |

The agent proposes; you challenge edge cases and product behavior. Expect
2–3 iterations. Never skip this for a domain module.

### 2. PLAN — `/plan <module>`

| | |
| --- | --- |
| Agent | Chat agent (can continue the spec session or start fresh) |
| Model | Same top-tier model as SPECIFICATION |
| Command | `/plan` with the module name |
| Input | The approved spec |
| Output | Task breakdown appended to the spec (`## Implementation tasks` section): each task ≤ ~300 diff lines, with explicit dependencies and its test list |
| Done when | You approve the breakdown; tasks that can run in parallel are marked |

### 3. SCAFFOLD — phases 0–1 only, then never again

| | |
| --- | --- |
| Agent | One chat agent, **sequential, not parallel** — you review closely |
| Model | **Claude Fable 5 (thinking)** |
| Command | `/implement` (same command; the difference is the model and your attention) |
| Input | Specs for `core`, `db`, `contract` + the reference module spec (`pricing`) |
| Output | `packages/core`, `packages/db`, `packages/contract`, `packages/modules/pricing`, CI config |
| Done when | Foundation invariants (blueprint §2.1) are verified by tests; the reference module is exemplary — it is the template every later agent copies |

This is the most important stage of the whole project. The Encore-benchmark
lesson: an agent on an empty minimal framework invents anti-patterns, so the
patterns are locked in here, before mass generation.

### 4. IMPLEMENTATION — `/implement <module> <task>`

| | |
| --- | --- |
| Agent | **One agent per task**, background/cloud agents in parallel; one task = one branch = one PR |
| Model | **Grok 4.5 (fast, high)** — default. **Claude Fable 5 (thinking)** for sensitive surfaces: auth, payments, QES, webhooks |
| Command | `/implement` with module + task id |
| Input | The module spec, the task definition, the reference module as template |
| Output | A PR: tests first (TDD), then implementation |
| Done when | PR opened with green local checks and a description referencing the spec section |
| Escalation | A task failing review twice → rerun with Fable 5 |

### 5. REVIEW — `/review` + Bugbot (+ security review)

| | |
| --- | --- |
| Agent | (a) **Bugbot** on every PR; (b) a review agent via `/review` — **different model family than the implementer** |
| Model | **GPT-5.6** for review (implementers are Grok/Claude, so GPT is always cross-family). **GPT-5.6 (xhigh)** + the security-review agent for auth/payments/QES/webhooks PRs |
| Input | The PR diff + the module spec + `.cursor/rules/` |
| Output | Review verdict: approve, or change requests referencing spec/rules/ADR violations |
| Done when | Both reviewers approve; **a human merges** — you look only at contested spots |

### 6. VERIFICATION — CI, no agent

GitHub Actions on every PR (setting this up is a phase-0 task):
`tsc --noEmit` → ESLint (boundaries, no `any`) → Vitest (unit + integration
with Testcontainers Postgres) → contract check (action without
description/permissions/risk metadata = error). Merging without green CI is
impossible — branch protection.

## Special roles (outside the main flow)

| Role | Model | When |
| --- | --- | --- |
| Debugging hard bugs | **Claude Opus 5 (thinking, high)** | Escalation when the working model can't find the root cause in 1–2 iterations |
| ADR drafting | Same as SPECIFICATION | When any stage hits a decision the blueprint doesn't cover, or wants to deviate from an accepted ADR |

## Rules that keep the pipeline honest

1. **Writer ≠ reviewer.** Never review a PR with the same model family that
   wrote it.
2. **Spec is frozen during implementation.** An implementer who finds a spec
   gap reports it; the spec owner (you + top model) amends; only then does
   implementation continue.
3. **Escalate, don't grind.** 2 failed review iterations → stronger model.
   1–2 failed debug attempts → Opus 5.
4. **Model lineup drifts monthly** — the names above are roles (blueprint
   §7.3); substitute current equivalents, keep the tiering.

## Health metrics (blueprint §7.4)

Track per module: % PRs merged without human edits (target >80% after the
reference stabilizes), review iterations per PR (≤2), spec→green-CI time,
regressions reaching main (~0).
