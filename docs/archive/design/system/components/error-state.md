# Error State Contract

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-17 · Safe failure and recovery

## Use and interface

Use for failed, blocked, partial, or uncertain operations. Use inline field
errors for validation and a summary when several fields fail. Do not replace
known empty/loading/disabled/completed states or reveal private existence.

Conceptual inputs: kind, localized title/safe explanation, authorized object or
operation, preserved-progress/unchanged-facts summary, exactly one primary
recovery, optional field association/last-sync/partial-stage summary.

Variants: validation, permission, unavailable, offline, partial, unknown
outcome, unexpected. Each has distinct copy and recovery.

## Behavior and content

- Failed submit focuses summary or first invalid field; realtime errors do not
  steal focus.
- Preserve input, context, stable IDs, and idempotency identity.
- Retry only safe reads/idempotent failed stages; unknown mutation first
  refreshes authoritative state.
- Keep recovery reachable above keyboard and inside safe areas.
- State what failed, safe reason, unchanged facts, and one next action.
- Separate domain, sync, projection, model, rendering, and provider failures.
- Never show generic-only copy, raw code/ID/permission, private existence, or
  unsupported completion/payment/signature/verification.
- Announce a new error/transition once and group repeats.

## Dual-flow and tokens

Classic keeps error beside preserved work/canonical object. AI distinguishes
model, action, and rendering failure; unknown outcomes refresh before same-key
retry. Generative failure always yields text plus labeled classic recovery.

Use `colors.semantic.status|surface|text|border|focus`, `space.*`,
`dimensions.touch.minimum|icon.*`, `typography.role.*`, and `motion.*` from
`tokens.md`; color never carries semantics alone.

## Acceptance

- All seven variants preserve progress and expose exactly one safe recovery.
- Cross-tenant/private fixtures leak nothing and unknown writes never repeat
  blindly.
- Focus/announcement, keyboard/switch, safe areas, 44×44, 200% text, contrast,
  localization, reduced motion, and Classic/AI fallback pass.
