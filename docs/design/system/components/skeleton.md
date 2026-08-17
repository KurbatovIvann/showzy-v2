# Skeleton Contract

> Status: Complete; pending SYSTEM Approval #3  
> Linear: SHO-17 · Initial layout placeholder

## Use and interface

Use for predictable initial layouts where reserving geometry reduces shift.
Do not use for unknown structures, short operations better served by progress
text, refresh where safe content can remain, or AI token streaming.

Conceptual inputs: containing-region loading label, layout shape/count/density,
and initial/incremental/refresh context.

Variants: text, avatar/media, list/card, composite. States: initial,
incremental, retained-content refresh, complete, failed. Failure transitions to
error/partial, never empty.

## Behavior and content

- Shapes are inert, unfocusable, and absent from the accessibility tree.
- Region exposes Busy and announces loading once, not per shape.
- Completion/failure announces one meaningful transition.
- Do not move focus/list position or replace a focused item.
- Preserve reachable controls or explain why disabled.
- Replacement content keeps stable geometry/focus.
- Name the operation at region level; shapes contain no labels/fake data.
- Retained content shows age/synchronization where relevant.
- Reduced Motion uses a static placeholder; flashing/looping/shimmer is
  prohibited.

## Dual-flow and tokens

Classic lists/cards use stable geometry. AI uses a stable pending card or
concise loading text, not skeletonized prose; generation exposes Pause/Stop.
Generative failure keeps textual outcome and classic route.

Use `colors.semantic.skeleton|surface`, `opacity.*`, `space.*`, `radii.*`,
`typography.*`, and standard/reduced `motion.*` from `tokens.md`.

## Acceptance

- Accessibility-tree exclusion, one announcement, focus/layout stability,
  contrast, initial/incremental/partial/failure states, and static reduced
  motion pass in Classic and AI contexts.
