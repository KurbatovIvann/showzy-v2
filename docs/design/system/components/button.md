# Button Contract

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-16 · Action component

## Use and interface

Use for commands, submission, consequential navigation, and confirmation. Do
not use for passive status, filters, or a card containing independent actions.

Conceptual inputs: localized `label`; `variant` primary/secondary/quiet/danger/
link; compact/default/prominent size; enabled/focused/pressed/pending/disabled
state; routine/consequential/destructive risk; optional classic-review
requirement, stable mutation-attempt reference, icon, and activation.

Primary is the single dominant regional action. Danger is destructive only.
Link never disguises a mutation. Every visual size retains 44×44 and wrapped
200% text.

## Behavior and content

- Touch, Enter, Space, and switch produce one logical action.
- Pending locks repeat activation, retains attempt identity, exposes Busy, and
  uses operation-specific text; pending is never success.
- Disabled important actions expose a reason.
- Human confirmation opens a classic summary focused before the destructive
  action.
- Use exact verbs such as Create, Confirm, Cancel, Delete; avoid OK/Yes/Done.
- Unknown mutation outcome refreshes state before another attempt.
- Offline disables unsafe writes; safe replay retains attempt identity.

## Dual-flow, accessibility, and tokens

Classic uses buttons in forms/lists/confirmation. AI uses proposal, Stop,
Retry, classic-route, and verified-result actions. Company writes show role and
company; Global actions imply no company authority.

Expose localized name, button role, disabled/busy state, and unfamiliar
consequence. Provide 3:1 visible focus, 44×44, keyboard/switch/screen-reader,
200% text, grayscale, muted-feedback, and reduced-motion support.

Use `colors.semantic.action|text|focus`, `typography.role.label`, `space.*`,
`dimensions.touch.minimum`, `radii.*`, and `motion.*` from `tokens.md`.

## Acceptance

One activation, pending lock, confirmation, and same-attempt retry are testable;
risk/result is non-color and completion waits for verified evidence.
