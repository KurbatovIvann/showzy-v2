# Module specifications

One file per module: `<module>.md`. Written by an agent in Plan mode,
approved by a human, then treated as a contract — implementing agents may not
change a spec, only send it back for rework.

Every spec follows `template.md` (purpose, owned tables, actions with full
contracts incl. principal mode, events, state machines and concurrency, edge
cases, v1 migration notes, NFRs, acceptance criteria, changelog). See
`docs/blueprint.md` §7.1.

Cross-domain foundation contracts (`core`, `db`, `contract`, `money`,
`security-operations`) may own protocols rather than domain tables/actions;
their acceptance criteria are inherited by module specs.

Task breakdowns do NOT live here — they are mutable and belong in
`docs/plans/<module>.md` (produced by `/plan`). Spec changes go only through
`/rework-spec` with human approval.
