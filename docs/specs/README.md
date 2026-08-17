# Module specifications

One file per module: `<module>.md`. Written by an agent in Plan mode with
the human. Every spec follows `template.md`. See `docs/blueprint.md` §7.1.

A spec is **not** a contract because a human approved the draft. It becomes
a contract when the first implementation of that module merges.

## Statuses

| Status | Meaning | Who may edit |
| --- | --- | --- |
| **Living** | Intent. No merged code for this module yet | Owner or spec agent in a normal commit; implementer/scaffold in the same PR when a test proves a gap. Do not invent product decisions silently |
| **Active** | Merged code exists, or this PR is the first implementation | `/rework-spec`, or a same-PR patch when a test proves the contract is wrong. Human reviews the spec diff |
| **Archived** | History in `docs/archive/` | Nobody. Not authority |

`/rework-spec` applies only to **Active** specs. There is no rework queue
for Living documents.

Cross-domain foundation specs (`core`, `db`, `contract`, `money`,
`security-operations`) may own protocols rather than domain tables/actions;
their acceptance criteria are inherited by module specs.

Task breakdowns do NOT live here — they are mutable and belong in
`docs/plans/<module>.md` (produced by `/plan` from a Living or Active spec).

## Current ledger (2026-08-18)

**Active** — first implementation has merged, or the file is the in-flight
scaffold contract:

- `db.md`
- `companies-foundation.md`
- `money.md`
- `feature-flags.md`

**Living** — no module code yet; do not freeze:

- `core.md`, `contract.md`, `security-operations.md` (become Active on the
  first merged `packages/core` / contract / auth PR)
- `orders.md`, `chat.md`, `payments.md`
- `catalog.md`, `companies.md`, `customers.md`, `pricing.md`, `search.md`

Phase-1 reference work uses the slice boundary already written in
`orders.md` §1.1 and `chat.md` (order-card projection only). Do not freeze
the full files for that slice. If a tighter card is needed later, add
`docs/specs/slices/` rather than freezing the novel.
