# ADR-0029: Autonomous parent conveyor

- **Status**: Accepted
- **Date**: 2026-08-28
- **Deciders**: owner (encoded from the SHO-183 staff price-lists run)

## Context

ADR-0023 and `docs/pipeline.md` assumed the human is the conductor: one
`/ticket` thread per child, **a human merges**, and “there is no automatic
orchestrator.” Writer ≠ reviewer when `/review` or `/guard` runs.

The SHO-183 feature run used a **parent** Cloud Agent as orchestrator:
one isolated cloud `/ticket` executor per child, sequential because
`pricing` and `apps/mobile` files overlapped, squash-merge when GitHub
Actions was green. That worked for backend and UI, including `sensitive`
children, and for follow-ups filed from post-merge `/review`
(REQUEST CHANGES → new child, Do not reopen Done).

Two process facts that run contradicted the old manual:

1. **Nested Task tools fail in cloud executors.** A child launched with
   Task `environment: cloud` cannot launch nested Task `bugbot`, isolated
   `/review`, or `security-review`. Executors that treated that as a
   ticket failure (or that applied `review.md` / `guard.md` and called it
   independent review) made the writer the reviewer. Filed as SHO-197.
2. **GitHub-hosted Cursor Bugbot / Security Reviewer checks are not a
   reliable merge gate.** They often land `neutral`, after merge, or as
   “usage limit reached.” The seven GitHub Actions jobs plus parent-launched
   Task Bugbot / security-review are what actually gated SHO-183 merges.
   Isolated `/review` often finished **after** squash-merge.

Waiting for Cursor to allow nested Task from a cloud child would block
every autonomous feature run. Requiring a human merge on every child
throws away the run that already shipped SHO-184–SHO-190 and SHO-198–SHO-200.

## Decision

A **parent orchestrator** may run the feature loop for a Linear feature
parent (`/implement SHO-<parent>` or `/ticket SHO-<parent>` when that
issue has children or label `Feature`). The parent does not implement.
It launches one cloud `/ticket` executor per child, attaches independent
reviews from **its** conversation, and squash-merges when the merge gate
in `.cursor/commands/conveyor.md` is green.

**Writer ≠ reviewer** is the parent’s independent Task Bugbot,
security-review, and `/review` — not nested tools inside the child, and
not the child’s in-process self-check.

Nested Task unavailability in cloud executors is **expected**. Children
must not fail the ticket for it. They self-check `review.md` / `guard.md`
and leave independent review to the parent.

A human still closes the **feature parent**. Children go Done on merge.
A leaf `/ticket` that is not under a parent conveyor still does not
merge itself.

## Alternatives considered

- **Wait for nested Task in cloud executors** — rejected: it blocked
  SHO-183; the parent can already launch those tools.
- **Keep “human merges every PR”** — rejected for the parent-conveyor
  path: the owner ran autonomous squash-merge on green Actions. Leaf
  `/ticket` without a parent still does not merge.
- **Treat executor self-check as independent `/review`** — rejected:
  writer = reviewer. Self-check is extra; parent Task tools are the
  independent pass.
- **Block merge on GitHub Cursor Bugbot / Security Reviewer checks** —
  rejected: usage limits and late/neutral checks stalled PRs that already
  had parent Task Bugbot + security-review + green Actions.

## Consequences

- Commands: `/implement` and `/ticket` dispatch to
  `.cursor/commands/conveyor.md` on a feature parent. Leaf path is
  unchanged except draft PRs, Linear `In Review`, Linear `gitBranchName`
  + `skip_branch_prefix_check`, and the SHO-197 nested-Task rule.
- `docs/pipeline.md` describes the optional parent conductor. ADR-0023’s
  four roles stay; this ADR adds who launches them on a whole feature.
- Follow-up from post-merge REQUEST CHANGES (blockers/majors) is a **new**
  child, never reopen Done. Nits are comments.
- Process-gap tickets like SHO-197 are documentation, not module work.
