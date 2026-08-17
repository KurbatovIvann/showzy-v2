# Modal Contract

> Status: Complete; pending SYSTEM Approval #3  
> Linear: SHO-17 · Applies to Classic confirmation and AI handoff

## Use and interface

Use for a necessary decision, concise confirmation, or self-contained task.
Do not use for navigation, passive status, long workflows, or dense
document/QES review. Prefer a sheet for lightweight choices and full screen for
complex work.

Conceptual inputs: visibility, localized title/description/content, primary,
secondary, Close/Back actions, risk, confirmation summary, busy/dismissal
policy, initial/return focus, and preserved draft.

Variants: information, confirmation, destructive confirmation, compact form.
States: opening, open, busy, validation/action error, closing. Stacking modals
is prohibited.

## Behavior and content

- Contain focus and hide background; restore focus on close.
- Focus title/consequence summary, never destructive action.
- Visible Close/Back/Cancel and safe Back/Escape are mandatory.
- Blocked dismissal explains why and offers a safe route.
- Keyboard, safe-area, both-orientation, and 200% layouts remain operable.
- Context switch closes/invalidates pending confirmation.
- Summary states actor, company, target, effect, destination, reversibility,
  and consequence where applicable.
- Use exact verbs, not Yes/OK/Continue/Done; preserve valid input after failure.

## Dual-flow and tokens

Classic UI owns dense and consequential human confirmation. AI may prepare and
invoke the modal, but cannot confirm/sign or claim outcome. Return to AI only
after authoritative refresh. Failed generative rendering uses text plus a
labeled classic route.

Use `colors.semantic.overlay|surface|text|risk|border|focus`, `space.*`,
`dimensions.touch.minimum`, `radii.*`, `elevation.*`, `typography.role.*`,
`layers.modal`, and `motion.*` from `tokens.md`.

## Acceptance

- 44×44, focus/background/restoration, keyboard/switch, screen readers, safe
  area, orientation, 200% text, contrast, localization, and reduced motion pass.
- No ambiguous action, destructive-first focus, cross-context proposal, or
  missing AI fallback.
