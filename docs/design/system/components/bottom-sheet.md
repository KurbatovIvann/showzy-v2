# Bottom Sheet Contract

> Status: Complete; pending SYSTEM Approval #3  
> Linear: SHO-17 · Applies to Classic and AI handoffs

## Use and interface

Use for short selection, compact form, contextual actions, or reversible
review. Use a full screen for long workflows, dense legal/QES review, or
content that cannot work at 200% text.

Conceptual inputs: visibility, localized title/description, content, primary
and secondary actions, explicit Close/Back, dismissal policy, initial/return
focus, busy state, and unsaved-change warning.

Variants: standard, selection, action, expanded/form. States: opening, open,
busy, validation error, blocked dismissal, closing.

## Behavior and content

- Contain focus; hide background from the accessibility tree.
- Initial focus targets title/summary/first control, never destructive action.
- Restore focus to invoker or nearest valid replacement.
- Back/Escape/swipe close only when safe; every gesture has a visible
  alternative.
- Keep fields/errors above keyboard and all content within safe areas.
- At 200% text, expand or scroll without clipping actions.
- Dismissal never submits or changes context; warn before losing input.
- Name task and company/role; distinguish Close from domain Cancel.

## Dual-flow and tokens

Classic UI preserves screen position/draft. AI may open a sheet for controlled
selection/review but never represent it as an inline generative card. Return to
AI refreshes current state. Rendering failure provides text plus a labeled
classic destination.

Use `colors.semantic.overlay|surface|text|border|focus`, `space.*`,
`dimensions.touch.minimum`, `radii.*`, `elevation.*`, `typography.role.*`,
`layers.sheet`, and `motion.*` from `tokens.md`.

## Acceptance

- 44×44 targets, focus containment/restoration, keyboard/switch order,
  screen readers, safe areas, both orientations, 200% text, contrast,
  localization expansion, and reduced motion pass.
- No destructive default, touch-only dismissal, clipping, context leakage, or
  missing textual/classic AI fallback.
