# Implementation plans

One file per module: `<module>.md`, produced by `/plan` from the module spec
in `docs/specs/<module>.md`. The spec may be **Living** or **Active** —
planning does not freeze it.

Specs and plans are deliberately separate:

- **Living specs** are working intent. Plans may be cut from them. Either
  file may change as work progresses.
- **Active specs** are contracts for merged (or in-flight first)
  implementation. They change only through `/rework-spec` or a same-PR patch
  when a test proves a gap.
- **Plans** are working documents — task breakdowns with dependencies,
  context packs, and test lists. They may be re-cut (tasks split, reordered,
  re-estimated) without a spec ceremony.

Each plan task maps 1:1 to a Linear ticket in team **Showzy-v2**
(created by `/plan`, executed via `/ticket`). One task = one branch = one PR
≤ ~300 diff lines.

Cross-cutting owner-approved programs may also have a roadmap plan that points
to module specs/plans without replacing them. `v1-mobile-ux-migration.md` is
the mobile parity roadmap from ADR-0019/0020. Backend work does not wait on
a spec-rework queue. Product screens wait on the UX gate.
