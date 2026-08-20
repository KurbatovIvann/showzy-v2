# Spec process after Phase 0 — Plan

> Status: **superseded by ADR-0023**. Kept as history. Do not execute
> remaining slice-card work (sp-T3) as a `/spec` stage.
>
> Status was **executing** (sp-T1 + sp-T2). Owner-reviewed 2026-08-19.

Sources: Phase-0 retro, owner review of this plan, `docs/specs/README.md`,
`docs/specs/template.md`, `.cursor/commands/spec.md`,
`docs/plans/foundation.md` (freeze gate **and** Milestone F Entry gate),
`docs/pipeline.md`, `docs/blueprint.md` §7.1, `docs/scope.md` §7,
ADR-0019/0020.

This is a cross-cutting process plan, not a module `/plan`.

---

## 1. Goal

Keep SDD and the architectural freeze (invariants, ADRs, `packages/core`).
Change **when** a spec becomes a contract and **how dense** a Living file
is allowed to be, so early implementation can correct mechanical detail
without a `/rework-spec` ceremony.

The command `.cursor/commands/spec.md` already says “specify the slice
about to be built; do not novelize unimplemented phases.” The template,
stale ledger, freeze-gate, Milestone F Entry gate, and Living files that
still say `/rework-spec` undo that sentence. This plan makes the sentence
the actual rule.

What the retro already got right (verified in-repo, owner 2026-08-19):

- **D3 is not a status change.** The ledger itself says `core` /
  `contract` / `security-operations` “become Active on the first merged
  `packages/core` / contract / auth PR”. That merge is fnd-T8…T28 + A12.
  The PR wording is: *the ledger catches up to reality.*
- **D4 is a false freeze.** `feature-flags.md` has been Active since
  2026-08-17; `packages/modules/` does not exist; fnd-T43 is milestone H
  after fnd-G2. Return it to Living.
- **Novels are real.** Living files with no merged module code include
  `catalog.md`, `companies.md`, `customers.md`. `orders.md` / `chat.md`
  tell future phases to use `/rework-spec` (they are Living — that is
  the sp-T2 mixed-message fix).
- **Stop-vs-amend with examples is the load-bearing rule.**
  `implement.md` / `ticket.md` already say “Living → amend in the PR”;
  without examples agents treat every gap as a stop.

---

## 2. Owner decisions (accepted)

| # | Decision | Accepted as |
| --- | --- | --- |
| D1 | Three-layer spec model | Constitution / Living intent / slice contract |
| D2 | When a surface becomes Active | After the implementing slice **merges**. The first implementing PR may still patch the spec in the **same PR** when a test proves the contract wrong — that path stays in the status table. “After merge” is the file-level default, not a ban on in-flight patches. |
| D3 | Runtime specs | Ledger catch-up: `core.md`, `contract.md`, `security-operations.md` are already Active by the standing rule. `db.md`, `money.md`, `companies-foundation.md` stay Active. |
| D4 | `feature-flags.md` | Living until fnd-T43 merges |
| D5 | Freeze gate before F | Delete it. Replace with: Living slice boundaries; **schema columns freeze in the schema PR** (owner reviews irreversible columns when they land), not in a separate pre-F ceremony. |
| D6 | Existing domain novels | Do not rewrite. Add a density banner on those files so agents do not treat unimplemented sections as frozen. Slim a file when that module’s `/plan` starts. |
| D7 | Phase-1 slice cards | Follow-up after Expo (D8). Not in the rules PR. |
| D8 | Remaining sequence | Expo (I) before reference slices (F/G) |
| D9 | Milestone H vs `scope.md` | Keep H after G2. Patch **Contents** of Phase 0 in `scope.md` §7 (payments / feature-flags live there today). The Readiness criterion already does not require them. |
| D10 | Experience Foundation recut | Out of this plan |

---

## 3. The model (D1)

### Layer A — Constitution (already frozen)

`docs/blueprint.md` §2.1, accepted ADRs, `.cursor/rules/prohibitions.mdc`.
Change only via a new ADR or an owner-accepted constitution patch.

### Layer B — Living intent

`docs/specs/<module>.md` while no merged implementation of **that slice**
exists.

Required: purpose, ownership (what it does not own), invariants, principal
modes this module will use, named capabilities (action/event **names** +
one-line intent), owned-table names if already known.

Forbidden in Living intent: full Zod tables, per-action timeout/rate-limit
rows, complete CHECKs, for phases that are not about to be built.

Budget: roughly 100–200 lines for a module that is not the next slice.
Existing novels may exceed this until a later slim (D6); agents must not
*add* density.

Who may edit: owner, `/spec` agent, or implementer in the same PR.
`/rework-spec` does **not** apply to Living remainder.

**Stop vs amend** (examples — copy into `implement.md` / `ticket.md` /
`docs/specs/README.md`):

- **Stop and ask** — a product fork not in the spec: new capability, new
  principal, change to an invariant, “should this action exist at all”,
  changing who may call it (staff vs customer), adding a table the slice
  did not name.
- **Amend in the same PR, mention in the description** — mechanical
  contract detail: core defaults for timeout/rate-limit, a Zod refine a
  test proved, a CHECK/column required by a spec-implied constraint, a
  missing metadata field that `defineActionContract` requires.

### Layer C — Slice contract → Active surface

Written immediately before (or in) the PRs that implement that slice.
Full action metadata applies **only to actions in the slice**.

**Tables are the irreversible part.** For schema tasks (e.g. fnd-T29…T32)
the slice-contract for columns is the schema PR itself: the owner reviews
and merges frozen columns at the moment they become expensive to change.
That is the cheap replacement for the deleted pre-F freeze-gate (D5).
Actions remain tighten-able in their implementing PR under stop-vs-amend.

A surface becomes Active when that slice has merged (D2). The same PR that
lands the first implementation may still patch the spec when a test proves
the contract wrong — keep this row in the status table explicitly so
“Active after merge” does not delete the in-flight patch path.

Later slices of the same module: update the **Active surface** header line
(below); do not freeze the unpublished novel. `/rework-spec` applies only
to the Active surface named in that header.

Foundation protocol specs (`core`, `db`, `contract`, `security-operations`,
`money`) are one slice: the whole file is the Active surface.

### Machine-readable mixed files (mandatory Status header)

File-level `Living` | `Active` is not enough once a module has a merged
slice and a leftover novel (`orders.md` after slice 2). Every spec header
must include an **Active surface** line so agents do not fall back to
file-level freeze:

```
> Status: Living | Active | Mixed.
> Active surface: none (Living intent).
>   — or —
> Active surface: entire file.
>   — or —
> Active surface: §1.1 slice (orders.create/confirm/get,
>   tables orders/order_items, events orders.created/confirmed).
> Remainder: Living intent. Update this line when a later slice merges.
```

`/rework-spec` and “do not silently edit Active specs” bind to **Active
surface**, not to the rest of the file. `Mixed` is the file-level status
when both an Active surface and a Living remainder exist.

Living novels that still contain unimplemented density (D6) also carry:

```
> Density beyond the declared slice is intent, not contract; do not treat
> unimplemented sections as frozen.
```

---

## 4. What we will not do

- Rewrite `catalog.md` / `companies.md` / `customers.md` / `pricing.md` /
  `search.md` / full `chat.md` in the process PR (D6). Banner only.
- Change `packages/core` or any runtime behavior.
- Recut Experience Foundation tickets (D10).
- Implement Expo or reference slices in this plan’s first PR (D8 is
  sequence after the rules land).
- New ADR — this is pipeline/spec-status process, not architecture.
- A second PR between rules and ledger: that window is the bug we are
  fixing. sp-T1 and sp-T2 ship together.

---

## 5. Tasks

### sp-T1 + sp-T2: Rules, ledger catch-up, mixed-file markers — **one PR**

Doc-only, one reviewer, no gap where the new rule contradicts the old
ledger.

#### Rules (sp-T1)

- Encode the three-layer model and the **Active surface** header in
  `docs/specs/README.md` and `docs/specs/template.md` (two clearly marked
  sections in **one** template file: Living intent vs slice/Active
  contract — do not split into a second template agents will miss).
- Status table: keep the same-PR patch row for Active/Mixed Active
  surface (“or this PR is the first implementation / a proving-test
  patch”). Active-after-merge is the default once the PR has landed.
- Copy stop-vs-amend examples into README, `implement.md`, `ticket.md`.
- Align `docs/pipeline.md` §1 and rule 2, `docs/blueprint.md` §7.1(1)
  (one paragraph), `docs/plans/README.md`, `AGENTS.md`, `README.md` specs
  row, `.cursor/commands/spec.md` (Living “must contain” vs slice “must
  contain”), `.cursor/commands/review.md`, `.cursor/commands/rework-spec.md`
  (target = Active surface, including Mixed files),
  `.cursor/rules/prohibitions.mdc`, `.cursor/rules/definition-of-done.mdc`.

#### Ledger catch-up and mixed messages (sp-T2)

- **Ledger catch-up (D3), not a status invention:** mark `core.md`,
  `contract.md`, `security-operations.md` Active with
  `Active surface: entire file`, dated to the first merged
  implementation (core/contract/auth), not 2026-08-19.
- Keep Active: `db.md`, `money.md`, `companies-foundation.md`.
- **False freeze (D4):** `feature-flags.md` → Living,
  `Active surface: none`.
- Living remainder: `payments.md`, `orders.md`, `chat.md`, `catalog.md`,
  `companies.md`, `customers.md`, `pricing.md`, `search.md`.
- Density banner (D6) on the Living novels that exceed a declared slice:
  at least `catalog.md`, `companies.md`, `customers.md`, `pricing.md`,
  `search.md`, `chat.md`, `orders.md` (orders/chat already declare a
  slice; the rest of those files is intent).
- Replace `/rework-spec` instructions for *future* phases in Living
  files (`orders.md`, `chat.md`, and any other hit) with “amend Living
  remainder / add a slice card; `/rework-spec` only for Active surface.”
- `docs/plans/foundation.md` — three freeze sites, all of them:
  1. mermaid `specGate{Freeze pricing catalog customers specs}`;
  2. resolved decision 1 (prerequisite schemas);
  3. **Milestone F Entry gate** (today: “the mobile-parity queue reworks
     and the owner approves the exact pricing, catalog, and customers
     reference subsets. This is not a status-only flip.”).
  Replacement: subsets stay Living; the implementing schema PR is the
  column freeze (owner review of fnd-T29…T32); facts/actions tighten in
  their PRs under stop-vs-amend. Keep the *subset* (T29–T34 facts only)
  — that is scope, not a file-level freeze.
- D9: in `docs/scope.md` §7 Phase 0 **Contents** cell, move
  `payments` provider abstraction and `feature-flags` skeleton to a
  footnote (“scheduled as milestone H after G2”). Do not rewrite the
  Readiness criterion — it already does not list them.

#### Ledger integrity test (inside this PR)

A Docker-free Vitest file, `fs` + regex, **no new npm package** (use
`vitest` already in the workspace). Parses `> Status:` and
`> Active surface:` from `docs/specs/*.md` (skip `template.md`) and
asserts they match the ledger lists in `docs/specs/README.md`.

Recommended home: `packages/tooling` with a `test` script, adding
`vitest` at the version already in the lockfile (`^4.1.10`) — not a new
library, only wiring. Fallback if that package.json edit is refused:
`node:test` script under `packages/tooling/scripts/` invoked from the
CI `checks` job.

This is the permanent form of “ledger matches Status headers.” The
2026-08-18 ledger vs merged core is exactly the class of drift it
catches.

- **Sensitive:** no. Full human review (constitution-adjacent).

### sp-T3: Phase-1 slice cards (follow-up, D7)

- Add `docs/specs/slices/` with three cards copied from existing
  boundaries, not newly invented product:
  1. pricing facts + `pricing.resolveProductPrices` (fnd-T29–T36),
  2. orders §1.1 (fnd-T37–T41),
  3. chat `order_cards` projection (fnd-T39, T42).
- Module files stay Mixed/Living as appropriate; cards become the named
  Active surface when their slice merges. Point `foundation.md` F/G
  context packs at the cards.
- **Do not start before Expo (I)** (D8): the typed client should fail in
  a real app before these cards freeze as templates.
- **Sensitive:** no.

### Sequence after the rules PR (D8, no extra ticket)

1. Milestone I — Expo (SHO-57…60).
2. Milestone F — pricing slice (SHO-61…68), then G — orders→chat
   (SHO-69…74). Schema PRs are the column freeze.
3. fnd-G2, then H — flags/payments (SHO-76…80).

Experience Foundation remains a parallel workstream (D10).

---

## 6. PR shape

| PR | Tasks | Why |
| --- | --- | --- |
| 1 | sp-T1 + sp-T2 (including ledger test) | Rules without a matching ledger recreate the bug. Owner: batch; do not split. |
| 2 | sp-T3 slice cards | After Expo; product-shaped even though it is copy-from-existing |

## 7. Definition of done for this plan

- Agents reading `/spec`, `/implement`, and `docs/specs/README.md` get
  one story: Living is editable intent; Active surface is implemented
  contract; `/rework-spec` is Active-surface-only; product forks stop
  the ticket; mechanical gaps patch in the same PR; mixed files name
  the Active surface in the header.
- Same-PR proving-test patch remains legal for Active surface.
- Density banners sit on Living novels; those files are not rewritten.
- Ledger matches Status headers, enforced by the integrity test.
- Runtime specs with merged code are Active (ledger catch-up).
- `feature-flags.md` is Living.
- All three F freeze sites in `foundation.md` are gone; schema PRs are
  the column freeze.
- `scope.md` Phase 0 Contents no longer lists H as Phase-0 contents.

## Changelog

| Date | Change | Why |
| --- | --- | --- |
| 2026-08-19 | sp-T1 + sp-T2 executed: three-layer rule, Active-surface header, ledger catch-up, density banners, F freeze-gate removed, Contents footnote for H, ledger integrity test | Owner asked to execute the plan |
| 2026-08-19 | Owner review: D3 = ledger catch-up; Active-surface header; F Entry gate; schema-PR column freeze; density banners; ledger test; D9 Contents-only; keep same-PR Active patch; batch T1+T2 | Owner amendments to the Phase-0 retro plan |
| 2026-08-19 | Initial plan from the Phase-0 retrospective | Owner asked for a change plan before editing the spec process |
| 2026-08-19 | Initial plan from the Phase-0 retrospective | Owner asked for a change plan before editing the spec process |
