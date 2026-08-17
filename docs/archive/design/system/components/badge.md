# Badge Contract

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-16 · Non-interactive semantic label

## Use and interface

Use beside an identified object for concise state, context, count, or
classification. Never use as a button, sole name/state record, unsupported
verification mark, or authority indicator.

Conceptual inputs: localized text; neutral/information/positive/caution/danger/
pending meaning; status/context/count/category kind; optional reinforcing icon
and expanded detail; no/polite live update; compact/default size.

Status names current state. Context distinguishes Global, Staff, Customer, or
role without granting authority. Count uses Ukrainian plural rules. Category
does not imply endorsement.

## Behavior and content

- Meaning is always textual, optionally reinforced by icon/border/structure.
- Unknown, pending, partial, failed, and completed are distinct; missing data
  never defaults to success.
- Non-interactive badge is not focusable; optional detail is a separate named
  control.
- Dynamic state announces only meaningful transitions.
- Use approved domain vocabulary, not raw enums/generic Success/Error.
- Never claim verified/paid/signed/delivered/completed without evidence.
- Loading does not render a misleading badge; stale/unknown is explicit.
- Offline badge cannot be the sole freshness/recovery information.

## Dual-flow, accessibility, and tokens

Classic and AI use identical localized state names. Staff may show queue
state/count, Customer owned-object state, Global published classification.

Text carries meaning in grayscale. Meet contrast and support screen reader,
200%/bold/expanded text, reduced motion; icon/haptic/animation never substitutes.

Use `colors.semantic.text|border|status|context`, `typography.role.labelSmall`,
`space.*`, `radii.pill`, and `motion.*` from `tokens.md`.

## Acceptance

Every meaning works without color/icon/position/animation; visible and
accessible text agree; count, stale, unknown, and 200% fixtures pass.
