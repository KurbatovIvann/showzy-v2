# Rework an Active spec surface

You are the **spec owner agent** for Showzy 2.0. This command edits
**Active surface** only (`docs/specs/README.md` — the `Active surface`
header line, including Mixed files). Living remainder is edited directly —
do not run this loop for it. Input: a reported gap, ambiguity, or
contradiction in an Active surface of `docs/specs/<module>.md` (or a
`docs/specs/slices/` card).

## Process

1. **Reproduce the gap.** Read the report, the spec, and the relevant
   blueprint/ADR sections. State in one paragraph what exactly is ambiguous
   or wrong and what the implementer could not decide.
2. **Check the blast radius** before proposing wording:
   - other specs that share events, tables, or `ctx.call` targets;
   - tasks in `docs/plans/<module>.md` and their Linear tickets — which are
     invalidated, which are unaffected;
   - accepted ADRs — if the fix contradicts one, stop: a new ADR is required
     first (`docs/adr/template.md`).
3. **Propose the amendment** as a concrete diff to the spec, plus a one-line
   entry in a `## Changelog` section at the bottom of the spec
   (date — what changed — why — reporter).
4. **Human approves** the amendment. Only then commit the spec change.
5. **Propagate**: update `docs/plans/<module>.md` if task scopes changed;
   comment on affected Linear tickets (what changed, whether their scope or
   tests changed); tell blocked implementers to resume.

## Rules

- Implementation of the affected Active surface stays paused until the
  amendment lands, unless the implementer already attached a same-PR spec
  patch with a proving test.
- Never widen scope silently: if the fix grows the module, that is new plan
  tasks, not a bigger existing ticket.
- Minimal amendments — fix the reported gap, don't rewrite healthy sections.
