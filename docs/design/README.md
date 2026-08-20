# Experience Foundation

This directory holds all UX and design-system artifacts for Showzy V2.

- **Process:** [`process.md`](process.md) — stages, outputs, approval criteria,
  and the UX gate definition.
- **Decision:** [ADR-0024](../adr/0024-magic-patterns-canonical-ux.md) — the
  Magic Patterns canvas is the canonical V2 UX. ADR-0019 (V1 parity) is
  superseded.
- **Prototype:** [Magic Patterns canvas](https://www.magicpatterns.com/c/g4fsekajwwkeex3v612gvp).
- **Design system:** Unistyles in `apps/mobile/src/theme/` and shared
  primitives in `apps/mobile/src/components/ui/`.
- **Port rule:** [`mapping/mp-to-mobile.md`](mapping/mp-to-mobile.md) —
  inventory the canvas, classify shared vs feature, reuse or create;
  do not paste React/Tailwind.
- **Inventory:** [`inventory/`](inventory/) — historical V1 map (domain
  coverage and edge cases, not visual acceptance).

## Current status

Owner reset the visual canon on 2026-08-20 (ADR-0024). Linear project
[Experience Foundation](https://linear.app/showzy-v2/project/experience-foundation-863513f2aa0a)
is **In Progress**. Visual acceptance is the Magic Patterns canvas mapped
into Expo. A Magic Patterns design-system preset is not part of the
workflow.

The UX gate is closed — **product screens in `apps/mobile`** remain blocked
until the Unistyles theme matches `mp-to-mobile.md` and the screen exists
on the canvas. Backend work is not gated. Expo shell/auth/deep-link
infrastructure remains the documented exception; new auth visuals still
follow the canvas.

Figma is not a source of tokens or components.

Archived greenfield DEFINE/SYSTEM docs in `docs/archive/design/` are not
authority.

## Relationship to the engineering pipeline

The engineering pipeline (`docs/pipeline.md`) is not modified to include
design stages. The only integration point is the **UX gate**: it blocks
product screens, not backend work. See `process.md` §"Integration with the
engineering pipeline."
