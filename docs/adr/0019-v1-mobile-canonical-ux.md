# ADR-0019: V1 mobile is the canonical V2 UX baseline

- **Status**: Accepted
- **Date**: 2026-08-17
- **Deciders**: Human owner
- **Supersedes**: ADR-0017

## Context

ADR-0017 started a greenfield Experience Foundation before the existing
Showzy V1 mobile application had been treated as a complete design input.
Three design approvals were granted, but no product prototype was completed
and the UX gate remains closed.

The current V1 mobile app is already a substantial, coherent product:

- about 49 leaf routes and 21 route layouts;
- 218 screen-component files and 28 shared UI primitives;
- customer, company, staff, chat, commerce, document, and account flows;
- established navigation, glass surfaces, gestures, transitions, loading
  states, Ukrainian/English copy, and light/dark themes.

The owner has decided that redesigning those flows is unnecessary risk. V2
must retain the proven mobile experience while replacing the Supabase,
NestJS, RLS, and direct-storage data paths with the V2 action architecture.
Web remains post-launch.

The V2 architecture still introduces requirements that V1 did not fully
express: verified principal contexts, AI/classic parity, accessibility,
idempotent retries, action confirmations, account deletion, and stricter
projection boundaries.

## Decision

The implementation at `E:\showzy\apps\mobile` is the canonical visual and
behavioral baseline for the V2 mobile application. The V1 repository remains
read-only.

The revised Experience Foundation proceeds in this order:

1. inventory V1 mobile routes, components, tokens, copy, motion, and states;
2. classify each behavior as preserve, adapt, review, or drop;
3. map every interactive behavior to a typed V2 action, event, or local-only
   state boundary;
4. rebaseline information architecture, journeys, tokens, and component
   contracts from V1;
5. evaluate parity prototypes internally;
6. open the UX gate only after design and API conflicts are resolved or
   explicitly deferred.

V2 targets maximum visual and behavioral parity. Deviations require one of:

- a V2 security or domain invariant;
- accessibility or platform compliance;
- an owner-approved product decision;
- a separately approved color-token rebrand.

V1 tokens and colors are carried first. Color changes are not mixed into the
initial port.

The existing V1 customer and staff navigation remains primary. The AI
assistant appears as a global text overlay with current-screen/entity context,
not as a replacement tab. AI uses the same domain actions as classic UI and
cannot bypass permissions, confirmation, or device-bound human steps such as
QES signing.

ADR-0017's useful quality constraints remain:

- mobile-first shared tokens and component contracts;
- one UX gate before production product screens;
- internal evaluation only, with no external-validation claim;
- technical shell/auth/deep-link infrastructure may precede the gate.

Approvals granted for the greenfield DEFINE and SYSTEM artifacts do not count
as evidence for the revised gate. They must be re-approved against the V1
baseline.

## Alternatives considered

- **Continue the greenfield Experience Foundation** — rejected because it
  discards a mature mobile interaction model and creates avoidable product
  and implementation risk.
- **Copy V1 source files and preserve its data layer** — rejected because V1
  directly couples screens to Supabase, NestJS, Socket.IO assumptions, and
  legacy authorization. Only UI behavior is canonical.
- **Preserve only the visual language and redesign screen flows** — rejected
  because the owner requires navigation, transitions, and task flows to
  remain the same.
- **Add a dedicated Assistant tab** — rejected because it changes canonical
  V1 navigation. A contextual overlay preserves classic UX.
- **Remove the UX gate** — rejected because parity still needs explicit,
  reviewable evidence before many agents implement product screens.

## Consequences

- The Experience Foundation plan and status are reset; the UX gate remains
  closed until V1-derived artifacts are approved.
- Existing research remains evidence but no longer overrides the V1
  implementation as the design source of truth.
- Product specs may need rework when the preserved UX requires missing
  actions. Frozen specs change only through the spec-rework loop.
- Presentational V1 code can often be adapted, but every Supabase/NestJS/data
  dependency is replaced by typed V2 contracts.
- Full agreed mobile parity is required before production launch. Incomplete
  slices are limited to internal cohorts through feature flags.
- The V1 application is never modified during the V2 port.
