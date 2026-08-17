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
| Output | `docs/plans/<module>.md`: each task ≤ ~300 diff lines, with explicit dependencies, a context pack, and its test list. After your approval the agent creates one Linear ticket per task (see "Linear workflow" below) |
| Done when | You approve the breakdown; tickets exist in Linear with `blocked by` relations; parallel tasks are marked |

### 3. SCAFFOLD — phases 0–1 only, then never again

| | |
| --- | --- |
| Agent | One chat agent, **sequential, not parallel** — you review every PR fully |
| Model | **Claude Fable 5 (thinking)** (or **Claude Opus 5 (thinking, high)** if Fable's data-retention terms are not accepted) |
| Command | `/scaffold` — has an explicit allowlist for foundation packages; `/implement` stays forbidden from touching them |
| Input | Accepted ADR-0016; approved core/db/contract, security/operations, money, companies-foundation, payment/feature-flag skeleton, and both reference-slice specs; approved ownership map and completed relevant v1 migration slices |
| Output | `packages/core`, `packages/db`, `packages/contract`, both reference slices, CI config with branch protection |
| Done when | Foundation invariants (blueprint §2.1) are verified by tests across all principal modes (ADR-0013); both reference slices are exemplary — they are the template every later agent copies |

This is the most important stage of the whole project. The Encore-benchmark
lesson: an agent on an empty minimal framework invents anti-patterns, so the
patterns are locked in here, before mass generation.

### 4. IMPLEMENTATION — `/ticket SHO-<n>` (wraps `/implement`)

| | |
| --- | --- |
| Agent | **One agent per ticket**, parallel where the dependency graph allows; one ticket = one branch = one PR |
| Model | **Grok 4.6 (high, non-fast)** — default (Fast buys latency at 2× price; irrelevant for background agents). **Claude Fable 5 / Opus 5 (thinking)** for `sensitive` tickets: auth, payments, QES, webhooks, file authorization, tenant/runtime protocols. **Composer 2.5** for purely mechanical/boilerplate tickets |
| Command | `/ticket` with the Linear ticket id — it analyzes the ticket, gates on blockers, then runs `/implement` rules and the GUARD steps (see "Linear workflow") |
| Input | The Linear ticket (context pack), the module spec, `docs/plans/<module>.md`, the reference slices as template |
| Output | A PR: tests first (TDD), then implementation; Linear ticket remains In Progress (the current workspace has no In Review state) with a summary/PR comment |
| Done when | PR opened with green local checks and a description referencing the spec section |
| Escalation | 2 failed review rounds → rerun on the stronger model; 3 → `/rework-spec` or human design review |

### 5. REVIEW — `/review` + Bugbot (+ security review)

| | |
| --- | --- |
| Agent | (a) **Bugbot** on every PR; (b) a review agent via `/review` — **different model family than the implementer** |
| Model | **GPT-5.6 Terra (high)** for routine review (implementers are Grok/Claude, so GPT is always cross-family). **GPT-5.6 Sol (high/xhigh)** + the security-review agent for foundation, migration, auth, payments, QES, and webhook PRs |
| Input | The PR diff + the module spec + `.cursor/rules/` |
| Output | Review verdict: approve, or change requests referencing spec/rules/ADR violations |
| Done when | Both reviewers approve; **a human merges**. Foundation and sensitive PRs receive a full human review; routine PRs may focus on contested spots after the references stabilize |

### 6. VERIFICATION — CI, no agent

GitHub Actions on every PR (setting this up is a phase-0 task and a hard
gate before any parallel implementation):
format check → secret/dependency review → `tsc --noEmit` → ESLint
(boundaries, no `any`) → Vitest (unit + integration with Testcontainers
Postgres) → action/event contract check (missing metadata, implementation,
transport exposure, resolver, or event definition = error) → migration
drift/safety check. E2e
smoke is phase-aware: Maestro once mobile screens exist,
Playwright only from the web phase. Merging without green CI is impossible —
branch protection.

## Linear workflow

Linear (team **Showzy-v2**, via MCP) is the work ledger; this repo is the
source of truth for contracts. Mapping:

- **Project = roadmap phase** (`Phase 0 — Foundation` … `Phase 8 — AI
  Experience`, then `V2 Production Launch`, then `Phase 9 — Web` …)
  plus the parallel `Experience Foundation` project.
  Milestones inside a project = modules / vertical slices (Experience
  Foundation uses process stages). **V2 Production Launch is its own
  project**, never a Phase 8 milestone.
- **Issue = one plan task** (one branch = one PR ≤ ~300 diff lines), created
  by `/plan` after you approve the breakdown. Dependencies = `blocked by`
  relations; parallel tasks have none.
- **Labels**: the existing child label `<name>` under the `module` group
  (for example `orders`), plus `sensitive`, `spec`, or `scaffold`.
- **Statuses**: Backlog (blocked) → Todo (ready) → In Progress (conveyor
  running and PR review) → Done (human merged). The current Showzy-v2
  workspace has no `In Review` state; PR state + the issue comment is the
  review signal. Canceled is for dropped tasks.

Day-to-day loop per ticket:

1. You open a fresh thread, pick the model per the ticket's routing (default
   Grok 4.6; `sensitive` → Fable 5/Opus 5), and type `/ticket SHO-<n>`.
2. The agent gates on blockers and understanding (ANALYZE), implements TDD
   on Linear's generated `gitBranchName` (or fallback
   `feat/sho-<n>-<slug>`), runs local checks and opens the PR (VERIFY), then
   launches Bugbot + cross-family `/review` (+ security review when
   `sensitive`) and posts the outcome to the ticket (GUARD).
3. **You merge.** Linear's GitHub integration links the issue identifier
   (`SHO-n`) in the branch/PR and closes tickets on merge. Enable it once:
   [Settings → Integrations → GitHub](https://linear.app/showzy-v2/settings/integrations/github)
   for workspace `showzy-v2`, repository `KurbatovIvann/showzy-v2`.

Spec gaps found mid-ticket stop the conveyor: the ticket returns to Todo
with a comment, and the fix goes through `/rework-spec` (human-approved
amendment + propagation to affected tickets).

## Special roles (outside the main flow)

| Role | Model | When |
| --- | --- | --- |
| Debugging hard bugs | **Claude Opus 5 (thinking, high)** — always a different family than the model whose code is failing | Escalation when the working model can't find the root cause in 1–2 iterations |
| ADR drafting | Same as SPECIFICATION | When any stage hits a decision the blueprint doesn't cover, or wants to deviate from an accepted ADR |
| Spec rework | `/rework-spec`, same top-tier model as SPECIFICATION | When an implementer or reviewer reports a spec gap; the only sanctioned way to edit a frozen spec |

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
5. **UX gate blocks product UI.** UI specs (`/spec` for screens), UI plans
   (`/plan`), and UI implementation (`/implement`) for product screens are
   blocked until the Experience Foundation UX gate is passed (ADR-0017,
   `docs/design/process.md`). Backend-only work and the Expo app shell
   infrastructure are not gated.

## Agent skills policy

Skills (`.cursor/skills/`, SKILL.md format) are **not** how this project
distributes conventions or process — that job belongs to `.cursor/rules/`,
the stage commands, the specs, and the reference slices. Skills fill exactly
two gaps the pipeline cannot:

1. **Fast-moving client tech** the models get wrong from memory (Expo Router,
   React Native performance, native platform patterns).
2. **Domain API references** absent from model training data (Monobank,
   Nova Poshta, DSTU/QES — Ukrainian APIs).

No backend-stack skills (Drizzle, Hono, oRPC, better-auth): for server code
the reference slices and specs are the only authority, and generic skills for
those libraries are the highest-risk source of conflicting patterns.

### Ground rules

1. **Skills are advisory.** On any conflict, `.cursor/rules/`, the module
   spec, ADRs, and the reference slices win. A skill never justifies
   violating a prohibition (e.g. raw SQL from a Postgres skill's examples).
2. **Vetted like dependencies.** Every third-party skill is reviewed by a
   human (or a review agent with human sign-off) for conflicts with our
   rules/ADRs before it lands in `.cursor/skills/`. Same bar as adding a
   package.
3. **Installed per phase, not up front.** A skill that cannot trigger on
   current work is context noise.

### Phased skill set

| Phase | Install | Notes |
| --- | --- | --- |
| 0–1 Foundation | **Nothing** | Foundation is written by top-tier models under full human review; third-party patterns must not leak into the templates |
| 2–3 Mobile screens | Official `expo/skills` (selective: `expo-project-structure`, `expo-router`, `expo-native-ui`, `expo-design-system`, `expo-data-fetching`) + **one** RN performance skill (Callstack `react-native-best-practices` or Vercel `react-native-guidelines`, not both) | Skip `expo-tailwind-setup` — we use Unistyles, not NativeWind |
| 3 Delivery | Hand-written **Nova Poshta API** skill, modeled on v1's `mono-aquiring` (API reference + minimal flow + webhook/edge cases) | No public equivalent exists; extract from v1 delivery code + official docs |
| Pre-MVP | `eas-app-stores` from `expo/skills` | TestFlight / store submission |
| 6 Web | Vercel `react-best-practices` + `composition-patterns` | Not earlier — they would trigger uselessly on mobile work |
| 7 Acquiring | Port v1 `mono-aquiring` as-is (SKILL.md + API reference files; keep only the Node example) | The one v1 skill worth carrying over; pure Monobank API knowledge, stack-agnostic |
| 8 Banking | Hand-written Monobank statements API skill | Same pattern as acquiring |

Everything else from v1 (`.cursor/skills` in `E:\showzy`) is deliberately
dropped: NestJS/Supabase-RLS skills contradict this architecture, Postgres
skills push raw SQL, and the "superpowers" process set duplicates — and in
places contradicts — this pipeline (human-conducted stages, human merges,
one ticket = one branch).

## Health metrics (blueprint §7.4)

Track per module: % PRs merged without human edits (target >80% after the
reference stabilizes), review iterations per PR (≤2), spec→green-CI time,
regressions reaching main (~0).
