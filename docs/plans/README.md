# Implementation plans

One file per module: `<module>.md`, produced by `/plan` from the module spec
in `docs/specs/<module>.md`. The spec may be **Living**, **Mixed**, or
**Active** — planning does not freeze Living remainder. Schema columns freeze
in their schema PR.

Specs and plans are deliberately separate:

- **Living remainder** is working intent. Plans may be cut from it. Either
  file may change as work progresses.
- **Active surface** is the contract for merged (or in-flight first)
  implementation. It changes only through `/rework-spec` or a same-PR patch
  when a test proves a gap. Mixed files name that surface in the header.
- **Plans** are working documents — task breakdowns with dependencies,
  context packs, and test lists. They may be re-cut (tasks split, reordered,
  re-estimated) without a spec ceremony.

Each plan task maps 1:1 to a Linear ticket in team **Showzy-v2**
(created by `/plan`, executed via `/ticket`). One task = one branch = one PR.
~300 diff lines is a review-comfort guideline, not a hard split.

Cross-cutting owner-approved programs may also have a roadmap plan that points
to module specs/plans without replacing them. `v1-mobile-ux-migration.md` is
the mobile parity roadmap from ADR-0019/0020. Backend work does not wait on
a spec-rework queue. Product screens wait on the UX gate.

`spec-process-after-phase-0.md` is the owner-reviewed process change after
the fnd-G1 retrospective. sp-T1 + sp-T2 (this change) encodes the three-layer
rule and ledger catch-up. Slice cards (sp-T3) wait until after Expo.
