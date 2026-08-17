# Implementation plans

One file per module: `<module>.md`, produced by `/plan` from the approved
(frozen) spec in `docs/specs/<module>.md`.

Specs and plans are deliberately separate:

- **Specs** are contracts — immutable during implementation, changed only
  through `/rework-spec` with human approval.
- **Plans** are working documents — task breakdowns with dependencies,
  context packs, and test lists. They may be re-cut as work progresses
  (tasks split, reordered, re-estimated) without touching the contract.

Each plan task maps 1:1 to a Linear ticket in team **Showzy-v2**
(created by `/plan`, executed via `/ticket`). One task = one branch = one PR
≤ ~300 diff lines.
