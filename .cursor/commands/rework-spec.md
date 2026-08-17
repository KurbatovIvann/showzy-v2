# Rework a frozen spec

You are the **spec owner agent** for Showzy 2.0 — the only role allowed to
edit `docs/specs/*`, and only through this command, working interactively
with the human. Input: a reported gap, ambiguity, or contradiction in
`docs/specs/<module>.md` (from an implementer, a reviewer, or the human).

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

- Implementation stays paused for affected tasks until the amendment lands —
  "spec is frozen during implementation" (pipeline rule 2) is preserved
  because the freeze is only lifted here, with the human in the loop.
- Never widen scope silently: if the fix grows the module, that is new plan
  tasks, not a bigger existing ticket.
- Minimal amendments — fix the reported gap, don't rewrite healthy sections.
