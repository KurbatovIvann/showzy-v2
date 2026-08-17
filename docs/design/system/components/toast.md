# Toast Contract

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-17 · Supplemental feedback only

## Use and interface

Use for low-risk acknowledgement or a short update represented durably
elsewhere. Never use as the only record of error, completion, identifier,
required action, legal state, validation, or unknown outcome.

Conceptual inputs: localized message, feedback level, optional supplemental
action/dismissal, announcement urgency, grouping key, timeout, and durable
record reference.

Variants: information, verified success, warning, error supplement, connection.
States: queued, visible, grouped/updated, dismissed, expired.

## Behavior and content

- Never steal focus or reading position.
- Interactive action is keyboard/switch reachable, 44×44, and also durable.
- Avoid safe areas, tabs, focused fields, and keyboard; wrap at 200%.
- Pause timeout for interaction and group bursts by object/operation.
- Name object plus verified result; never standalone Success or generic error.
- Distinguish domain outcome, operation, sync, and projection delivery.
- Expose no IDs, codes, permissions, provider payloads, or private existence.
- Announce once at suitable urgency; group realtime bursts and ignore typing,
  presence, unchanged updates, and AI token streaming.

## Dual-flow and tokens

Classic owner surface retains durable result/recovery. AI retains tool state in
conversation/domain cards; toast is supplemental. Generative failure always
produces text plus classic destination.

Use `colors.semantic.status|text|focus`, `space.*`,
`dimensions.touch.minimum`, `radii.*`, `elevation.*`, `typography.role.*`,
`opacity.*`, `layers.toast`, and `motion.*` from `tokens.md`.

## Acceptance

- Every outcome remains understandable if toast is missed.
- Dedup/grouping, safe-area/keyboard, timing, screen-reader announcement, 200%
  text, contrast, localization, and reduced motion pass.
