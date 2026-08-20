# Agent Pipeline — Operations Manual

How the feature loop from `docs/blueprint.md` §7 and ADR-0023 actually
runs in Cursor. The blueprint defines *what* the roles are; this file is
the day-to-day checklist: which agent, which model, which command, what
goes in, what comes out, and when a role is done.

**Key fact: there is no automatic orchestrator.** Cursor does not chain
agents by itself — the human is the conductor. Each role = you launch an
agent (chat, background, or cloud), pick the model in the model picker,
and invoke the command. The files in `.cursor/commands/` are the role
instructions.

```
PLANNER → EXECUTOR → VERIFIER → GUARDIAN (optional)
(human+agent)  (agent)    (CI + agent)   (sensitive / first slice)
```

Constitution stays: blueprint §2–§6, accepted ADRs, `.cursor/rules/`,
`docs/scope.md`, `docs/module-ownership.md`. Domain novels in
`docs/archive/specs/` are research, not a gate. The executable contract
of a feature is `*.contract.ts` plus the tests in the definition of done.

## Role reference

### 1. PLANNER — `/feature <name>`

| | |
| --- | --- |
| Agent | One chat agent in **Plan mode**, working with you interactively |
| Model | **Claude Opus 5 (thinking, high)** or **GPT-5.6 (xhigh)** |
| Command | `/feature` with a user-visible capability |
| Input | Constitution, ADRs, ownership map, golden slice files for the layer, v1 reference only if needed |
| Output | A Linear **feature card**, a ticket graph, and a 5–15 file context pack. Contested APIs also get a contract-first ticket (`*.contract.ts` only) |
| Done when | You approve the card and tickets exist in Linear with `blocked by` relations |

The agent proposes; you challenge product behavior. Expect a short
iteration, not a novel. Never invent a new principal, table, or invariant
silently — those stop and ask, or need an ADR.

A **feature** is one closed capability (e.g. “staff creates a product with
variants”). An epic is a Linear milestone. A ticket is one branch = one
PR (~300 diff lines is comfort, not a cap). Product screens wait on the
Experience Foundation UX gate; backend tickets do not.

### 2. EXECUTOR — `/ticket SHO-<n>` (wraps `/implement`)

| | |
| --- | --- |
| Agent | **One agent per ticket**, parallel where the dependency graph allows |
| Model | **Grok 4.6 (high, non-fast)** — default. **Claude Fable 5 / Opus 5 (thinking)** for `sensitive` tickets and for the **first golden slice**. **Composer 2.5** for purely mechanical work |
| Command | `/ticket` with the Linear ticket id — it lanes the ticket, gates on blockers, implements, and runs the verify loop |
| Input | The Linear card + ticket, the context pack, the golden files for this layer |
| Output | A PR with the required tests. Linear stays In Progress |
| Done when | PR opened with green local checks. Description names the feature card, the tests, and any deviations (there should be none — deviations mean stop) |
| Escalation | 2 failed verify/review rounds → stronger model; 3 → human design review or a new ADR |

The first backend slice is not cheap-model work. It becomes the golden
API template. Do not start catalog/companies (or extract backend skills)
until that slice has merged.

### 3. VERIFIER — CI always; `/review` by lane

| Lane | Review |
| --- | --- |
| **mechanical** | CI + human skim. No Bugbot/`/review` |
| **routine** | **Bugbot** + human. `/review` only if contested or a prior review failed |
| **sensitive / first-slice** | Bugbot + cross-family `/review` + `/guard` when `sensitive` or this is the first backend/UI golden + full human review |

| | |
| --- | --- |
| Agent | `/review` — **different model family than the implementer** — when the lane requires it |
| Model | **GPT-5.6 Terra (high)** for routine `/review`. **GPT-5.6 Sol (high/xhigh)** for foundation, migration, auth, payments, QES, webhook, and first-slice PRs |
| Input | The PR diff + the feature card + golden files + `.cursor/rules/` + ADRs |
| Output | Verdict: approve, or change requests referencing constitution / ADR / golden / DoD — not an archived spec section |
| Done when | Required reviewers for the lane approve; **a human merges** |

### 4. GUARDIAN — `/guard` (optional)

Safety and irreversibility, not style. Skip on mechanical and ordinary
routine work.

| When | What |
| --- | --- |
| `sensitive` | Security-review agent + strong cross-family pass (auth, payments, QES, webhooks, files, tenant/runtime protocols) |
| First golden backend or UI slice | Architecture pass vs ADRs and the intended copy template |
| First use of a new principal or composition edge | Same |
| Any ADR deviation | Stop. Do not land. Draft a new ADR instead |

| | |
| --- | --- |
| Model | **GPT-5.6 Sol (high/xhigh)** + the security-review agent when `sensitive` |
| Done when | Guardian findings are addressed on the same branch and VERIFY is green again |

## Golden slices

A golden is a designation, not a special package. Later Executors copy
those files. They do not invent a new folder shape.

**Backend (first).** Thin closed cut through the action stack — not an
entire product module and not API+UI in one blob:

- `packages/db/src/schema/<module>.ts` + generated migration
- one `risk: read` action
- one write action with event + subscriber if the slice needs the outbox
- `index.ts`, `index.contract.ts`, `suite-coverage`
- required DoD tests

Candidate: `pricing.resolveProductPrices` or thin `orders.create/confirm`
plus the order-card projection — whichever is the smaller closed cut.

**UI (later, after the UX gate).** One owner-first panel screen in
`apps/mobile`, bound to an already-shipped action, following
`docs/design/mapping/mp-to-mobile.md`. Until it exists, feature
cards that need a screen stop at the API ticket.

Core test fixtures in `packages/core/src/testing/` stay core-internal.

## Linear workflow

Linear (team **Showzy-v2**, via MCP) is the work ledger. Mapping:

- **Project = roadmap phase** (`Phase 0 — Foundation` … `Phase 9 — AI
  Experience`, then `V2 Production Launch`, then `Phase 10 — Web` …)
  plus the parallel `Experience Foundation` project.
  Milestones inside a project = features / vertical slices.
  **V2 Production Launch is its own project**, never a phase milestone.
- **Issue = one ticket** from `/feature` (one branch = one PR).
  Dependencies = `blocked by`; parallel tickets have none.
- **Labels**: the existing child label `<name>` under the `module` group
  (for example `orders`), plus `sensitive` when flagged. Do not invent
  a `spec` or `scaffold` label for new work.
- **Statuses**: Backlog (blocked) → Todo (ready) → In Progress (conveyor
  running and PR review) → Done (human merged). The current Showzy-v2
  workspace has no `In Review` state; PR state + the issue comment is the
  review signal. Canceled is for dropped tasks.

Day-to-day loop:

1. You open a thread in Plan mode, pick a top-tier model, and type
   `/feature <capability>`. Approve the card and tickets.
2. You open a fresh thread per ticket, pick the model for that lane, and
   type `/ticket SHO-<n>`.
3. The agent implements, runs VERIFY, opens the PR, and runs only that
   lane's Verifier / Guardian.
4. **You merge.** Linear's GitHub integration links `SHO-n` in the
   branch/PR and closes tickets on merge.

Gaps that are product forks (new capability, new principal, new table,
invariant change, “should this exist”) stop the ticket: it returns to
Todo with a comment. Mechanical contract detail (timeout / rate-limit
defaults, a Zod refine a test proved, a CHECK/column the card implied,
a metadata field `defineActionContract` requires) patches in the same PR
and is named in the description.

## Special roles (outside the main flow)

| Role | Model | When |
| --- | --- | --- |
| Debugging hard bugs | **Claude Opus 5 (thinking, high)** — always a different family than the model whose code is failing | Escalation when the working model can't find the root cause in 1–2 iterations |
| ADR drafting | Same as PLANNER | When any role hits a decision the blueprint doesn't cover, or wants to deviate from an accepted ADR |
| Leftover foundation | `/scaffold` | Phases 0–1 only; allowlisted packages. New domain work uses `/feature`, not `/scaffold` |

## Rules that keep the pipeline honest

1. **Writer ≠ reviewer** when `/review` or `/guard` runs. Never review
   with the same model family that wrote the PR. Mechanical PRs do not
   need `/review`.
2. **The contract is TypeScript.** `*.contract.ts` plus DoD tests. Do not
   write `docs/specs/<module>.md` or treat `docs/archive/specs/` as a
   gate. Protocol manuals for frozen packages may be patched in the same
   PR when a test proves them wrong; otherwise they change via ADR.
3. **Escalate, don't grind.** 2 failed review iterations → stronger
   model. 1–2 failed debug attempts → Opus 5.
4. **Model lineup drifts monthly** — the names above are roles (blueprint
   §7.3); substitute current equivalents, keep the tiering.
5. **UX gate blocks product screens in `apps/mobile`.** It does not block
   backend features. UI work must follow
   `docs/design/mapping/mp-to-mobile.md` and reference the Magic
   Patterns canvas screen, the running Expo SYSTEM, and
   `docs/design/process.md` (ADR-0024). Figma is not a gate artifact.
   Expo shell, auth, and deep-link infrastructure are not gated.
6. **Copy the golden. Do not invent layers.** Flag new abstractions,
   extra folders, or generic “clean architecture” that the golden does
   not use.

## Agent skills policy

Skills (`.cursor/skills/`, SKILL.md format) distribute **code patterns**,
not process and not constitution. Process lives in this file and the
commands. Constitution lives in the blueprint, ADRs, and `.cursor/rules/`.

### Ground rules

1. **Skills are advisory.** On any conflict, `.cursor/rules/`, ADRs, the
   golden files, and this pipeline win. A skill never justifies violating
   a prohibition (e.g. raw SQL from a Postgres skill's examples).
2. **Vetted like dependencies.** Every third-party skill is reviewed by a
   human before it lands in `.cursor/skills/`.
3. **No generic backend-stack skills** (Drizzle, Hono, oRPC, better-auth,
   raw Postgres). Those leak conflicting patterns.
4. **No Showzy backend skills until the golden backend slice has
   merged.** Then extract hand-written skills from that code:
   `showzy-action`, `showzy-schema`, `showzy-module-tests`,
   `showzy-events`. A `showzy-panel-screen` skill waits on the golden
   UI slice.

### Phased skill set

| Phase | Install | Notes |
| --- | --- | --- |
| Until golden backend merges | **Nothing backend** | Foundation and the first slice are written by top-tier models under Guardian |
| After golden backend | Hand-written Showzy skills listed above | Extracted from the golden files, not from memory |
| 2–3 Mobile screens | Official `expo/skills` (selective: `expo-project-structure`, `expo-router`, `expo-native-ui`, `expo-design-system`, `expo-data-fetching`) + **one** RN performance skill (Callstack `react-native-best-practices` or Vercel `react-native-guidelines`, not both) | Skip `expo-tailwind-setup` — we use Unistyles, not NativeWind. After the golden UI slice, add `showzy-panel-screen` |
| 3 Delivery | Hand-written **Nova Poshta API** skill | No public equivalent; extract from v1 + official docs |
| Pre-MVP | `eas-app-stores` from `expo/skills` | TestFlight / store submission |
| 6 Web | Vercel `react-best-practices` + `composition-patterns` | Not earlier |
| 7 Acquiring | Port v1 `mono-aquiring` as-is (SKILL.md + API reference; keep only the Node example) | Stack-agnostic Monobank knowledge |
| 8 Banking | Hand-written Monobank statements API skill | Same pattern as acquiring |

Everything else from v1 (`.cursor/skills` in `E:\showzy`) stays dropped:
NestJS/Supabase-RLS skills contradict this architecture, Postgres skills
push raw SQL, and process-skill packs duplicate this pipeline.

## Health metrics (blueprint §7.4)

Track per feature: % PRs merged without human edits (target >80% after
the golden backend slice stabilizes), review iterations per PR (≤2),
feature-card → green-CI time, regressions reaching main (~0).
