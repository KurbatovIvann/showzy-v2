# Experience Foundation

This directory holds all UX and design-system artifacts for Showzy V2.

- **Process:** [`process.md`](process.md) — stages, outputs, approval criteria,
  and the UX gate definition.
- **Decision:** [ADR-0019](../adr/0019-v1-mobile-canonical-ux.md) — V1 mobile
  is the canonical UX baseline and the gate verifies parity/adaptation.
- **Inventory:** [`inventory/`](inventory/) — canonical routes, components,
  tokens, motion, and state boundaries.
- **Mapping:** [`mapping/`](mapping/) — owner conflict dispositions and V2
  capability/spec mapping.

## Current status

Workstream reset by the owner on 2026-08-17. Linear project
[Experience Foundation](https://linear.app/showzy-v2/project/experience-foundation-863513f2aa0a)
is **In Progress**. The prior RESEARCH evidence is retained. Prior DEFINE
Approval #2 and SYSTEM Approval #3 are superseded pending V1-derived
re-approval. Inventory and owner conflict decisions are complete; capability
mapping is a reference for later slice work, not a freeze queue. Prototype evaluation remains
internal only and must not be presented as representative user validation.

The UX gate is closed — **product screens in `apps/mobile`** remain blocked.
Backend specs, plans, and implementation are not gated. Expo
shell/auth/deep-link infrastructure remains the documented exception.

Greenfield DEFINE journeys/IA and SYSTEM token/component docs were moved to
`docs/archive/design/`. They are not authority.

## Relationship to the engineering pipeline

The engineering pipeline (`docs/pipeline.md`) is not modified to include
design stages. The only integration point is the **UX gate**: it blocks
product screens, not backend work. See `process.md` §"Integration with the
engineering pipeline."
