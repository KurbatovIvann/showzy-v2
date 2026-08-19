# Module specifications

One file per module: `<module>.md`. Written by an agent in Plan mode with
the human. Every spec follows `template.md`. See `docs/blueprint.md` §7.1
and `docs/plans/spec-process-after-phase-0.md`.

A spec is **not** a contract because a human approved the draft. A
**surface** becomes a contract when the slice that implements it has
merged. File-level status is not enough once a module has both merged
code and a leftover novel — the **Active surface** line in the header is
what agents must obey.

## Three layers

| Layer | What it is | Who may edit |
| --- | --- | --- |
| **Constitution** | Blueprint §2.1, accepted ADRs, prohibitions | New ADR or owner-accepted constitution patch |
| **Living intent** | Purpose, ownership, invariants, principal modes, named capabilities. Not a freeze | Owner, `/spec` agent, or implementer in the same PR. `/rework-spec` does not apply |
| **Active surface** | Implemented slice (or entire foundation protocol file). Full action metadata | `/rework-spec`, or a same-PR patch when a test proves the contract is wrong. Human reviews the spec diff |

`/rework-spec` binds to the **Active surface**, not to Living remainder and
not to unimplemented density in the same file.

### File-level status

| Status | Meaning |
| --- | --- |
| **Living** | No merged implementation of this module yet. `Active surface: none` |
| **Active** | The whole file is the contract. `Active surface: entire file` |
| **Mixed** | A named slice has merged; the rest of the file is still Living intent |
| **Archived** | History in `docs/archive/`. Nobody edits. Not authority |

Every spec header must include `Status` and `Active surface` (see
`template.md`). `/rework-spec` and “do not silently edit Active surface”
apply only to the Active surface named there.

The first implementing PR may still patch that surface in the **same PR**
when a test proves the contract wrong. “Active after merge” is the
file-level default once the PR has landed — it does not delete the
in-flight patch path.

### Stop vs amend

Commands already say Living specs may be amended in the implementing PR.
Use these examples; do not treat every gap as a stop.

**Stop and ask** — a product fork not in the spec:

- new capability or action the slice did not name
- new principal mode, or changing who may call an action (staff vs customer)
- change to an invariant
- “should this action exist at all”
- adding a table the slice did not name

**Amend in the same PR, mention in the description** — mechanical contract
detail:

- core defaults for timeout / rate-limit
- a Zod refine a test proved
- a CHECK or column required by a spec-implied constraint
- a missing metadata field that `defineActionContract` requires

Schema columns are the irreversible part of a slice: they freeze when the
schema PR merges (owner review), not in a separate pre-phase ceremony.

Cross-domain foundation specs (`core`, `db`, `contract`, `money`,
`security-operations`) own protocols rather than domain tables/actions;
their acceptance criteria are inherited by module specs. Each of those
files is one slice: the whole file is the Active surface.

Task breakdowns do NOT live here — they are mutable and belong in
`docs/plans/<module>.md` (produced by `/plan` from a Living, Mixed, or
Active spec).

### Owner-first launch vs customer expansion (2026-08-19)

Owner-first launch is the **company panel** (staff/AI), then documents + QES
+ share. Customer cabinet, public storefront, consumer discovery, and the
business-chat **platform** are **customer expansion** — not dropped.

Living files named below were slimmed: full action/table density remains
only for owner-first / phase-1 slices. Deferred capabilities are **names +
one-line intent**. That supersedes spec-process D6 (“do not rewrite
novels”) for those files. Agents must not implement Deferred actions as
first-release work.

Do not treat unimplemented expansion sections as frozen. `/rework-spec`
still applies only to Active surface.

## Current ledger (2026-08-19)

The lists below are what the integrity test parses
(`packages/tooling/scripts/check-spec-ledger.test.mjs`). One backticked
`*.md` filename per bullet. Status headers in the files must match.

### Active (entire file)

- `core.md`
- `contract.md`
- `security-operations.md`
- `db.md`
- `companies-foundation.md`
- `money.md`

`core.md`, `contract.md`, and `security-operations.md` are ledger
catch-up: they became Active on the first merged `packages/core` /
contract / auth implementation (fnd-T8…T28), not by a new decision on
2026-08-19.

### Living (Active surface: none)

- `feature-flags.md`
- `payments.md`
- `orders.md`
- `chat.md`
- `catalog.md`
- `companies.md`
- `customers.md`
- `pricing.md`
- `search.md`

`feature-flags.md` returned to Living: it was marked Active on 2026-08-17
with no module code (`packages/modules/` does not exist; fnd-T43 is
milestone H after fnd-G2).

Phase-1 reference work uses the slice boundary already written in
`orders.md` §1.1 and `chat.md` (order-card projection only). Deferred
customer-expansion names in those files are intent, not a freeze.

### Mixed

None. A file moves here when a slice has merged and a Living remainder
remains. `orders.md` and `chat.md` become Mixed after their Phase-1
slices merge; update `Active surface` in the same PR.
