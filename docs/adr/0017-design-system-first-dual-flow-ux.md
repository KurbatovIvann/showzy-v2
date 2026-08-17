# ADR-0017: Design-system-first, mobile-first, dual-flow UX

- **Status**: Superseded by ADR-0019
- **Date**: 2026-08-17
- **Deciders**: Human owner
- **Amended**: 2026-08-17 — external participant research and usability
  testing removed; evaluation is internal only

## Context

Showzy V2 is not a minimal viable product — it is a production-grade rewrite
with a clear vision. The UI must feel polished from day one for Ukrainian small
business owners who are already trained by Instagram, Telegram, Monobank, and
Nova Poshta. Two orthogonal UI dimensions exist:

1. **Classic UI ↔ AI chat** — every business operation is accessible through
   both a traditional screen flow and an AI assistant that calls the same
   actions.
2. **Staff/company panel ↔ Customer cabinet ↔ Consumer discovery** —
   different personas and surfaces sharing the same app binary with
   role-based navigation (ADR-0018).

Building product screens without a validated design system and information
architecture risks expensive rework and inconsistent UX.

## Decision

No production product screen begins implementation until the Experience
Foundation is approved. The Experience Foundation delivers, in order:

1. UX research (Ukrainian market and competitor audit) with explicit
   separation between evidence, product constraints, and internal assumptions.
2. Information architecture and dual-flow journey maps.
3. Design tokens, core component contracts, content/accessibility principles.
4. Interactive prototypes evaluated by the human owner and one
   owner-designated reference user.
5. A UX gate — formal approval that the above artifacts are complete and
   internally evaluated.

The project does not recruit or compensate external research participants.
Internal evaluation may find and prioritize usability problems, but it is not
representative target-user validation and must never be described as such.

The design system is mobile-first (Expo + Unistyles tokens) and multi-flow
aware: every component considers the classic interaction path and the AI chat
surface, and the staff, consumer discovery, and customer contexts.

The Expo app shell, navigation skeleton, and authentication screens may be
built during the technical foundation (phase 0) as infrastructure; they are
not product screens and do not require the full UX gate. Product screens
(catalog, orders, chat, profile, etc.) are blocked by the gate.

## Alternatives considered

- **Design in parallel with feature implementation** — rejected: leads to
  rework when research invalidates assumptions; breaks consistency across
  screens built by different agents.
- **Copy an existing design system (e.g., Material, Tamagui defaults)** —
  rejected: does not account for the dual-flow requirement or Ukrainian
  user patterns; results in a generic feel incompatible with the product
  positioning.
- **Design per-screen on demand** — rejected: produces inconsistent UX and
  no reusable token/component system.

## Consequences

- A parallel Experience Foundation workstream runs alongside technical
  phases 0–1 and must complete before product UI phases begin.
- The engineering pipeline (`docs/pipeline.md`) adds a UX gate prerequisite
  for UI specs and UI implementation tasks.
- The design process is documented separately (`docs/design/process.md`)
  with its own stages and approval criteria.
- Later product phases may start backend work independently; only UI
  implementation is gated.
- The quality bar remains design-system-first with explicit internal
  evaluation, but external user validation is not a launch claim.
- Research summaries and UX Gate records must label evidence limitations and
  distinguish competitor facts from owner/reference-user assumptions.
