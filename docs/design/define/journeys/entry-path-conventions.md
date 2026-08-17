# Entry-Path Journey Conventions

> Status: Approval #2 granted by the owner on 2026-08-17  
> Linear: SHO-27 · Applies to discovery, invite, and direct-link journeys  
> Evidence: approved constraints and internal assumptions only

## Shared context rules

- Global discovery runs as authenticated, read-only `consumer` with
  `companyId: null`.
- A company/profile/product/chat/cart action transitions through a separately
  resolved `customer` or explicitly `public` action.
- Links, slugs, tokens, route data, AI text, and IDs are selectors, never
  access grants.
- Every company action rechecks publication, visibility, ownership, and
  permission.
- Role, company, target, and public-vs-authenticated state remain visible.
- Install/sign-in preserves opaque navigation intent, not authority.
- Handoffs pass stable IDs and refetch current state.

## CRM boundary

Discovery, profile browsing, cart, chat, direct-link entry, and invite
acceptance create no CRM row. Checkout/order creation atomically links or
creates it; staff may create one through an approved staff action.

ADR-0018's introductory text says an invite “creates or enriches a CRM
relationship,” while its normative CRM section permits creation only by staff
or checkout. These journeys follow the normative rule. The ADR wording must be
reconciled before invite implementation is specified.

## Shared classic ↔ AI rules

- AI is Global, Customer-company, or temporary object scoped.
- AI uses the same typed reads/cart as classic UI and owns no copied state.
- AI cannot convert a pasted link/token/ID into authorization.
- Dense visual comparison, authentication, account switching, and
  confirmation use classic UI.
- AI cards distinguish narration from authoritative action results.
- Raw invite tokens never enter model context or visible history.

## Shared fallback and recovery

- **Loading:** distinguish route restoration, authorization, and content load.
- **No results/empty:** explain whether search or a visible catalog is empty.
- **Offline:** preserve intent; show only dated safe cache and block actions
  requiring current visibility.
- **Error:** retain safe progress and offer one scoped Retry.
- **Stale:** refetch before display or mutation.
- **Not found/private:** reveal no private entity existence.
- **Unpublished company:** suppress cached details and company actions.
- **Deactivated/unpublished product:** disable cart action and offer the
  current published company where available.
- **Expired/revoked invite:** require a new invitation.
- **Wrong account:** reveal no expected identity; offer Switch account.
- **Already used:** continue only when current account can safely resolve the
  destination.
- **Retry:** rerun only the failed read/idempotent action and never duplicate a
  cart or acceptance effect.

## Accessibility and content

- Meet the approved WCAG 2.1 AA-oriented mobile baseline.
- Announce restoration, context change, and result without moving focus
  unexpectedly.
- Use descriptive actions and text/icon/structure, never color alone.
- Keep company identity visible on product/cart/confirmation.
- Never display or speak a raw invite token.
- Avoid social, endorsement, verification, and unsupported safety language.

## Internal evaluation baseline

For all six journeys, test installed/not-installed, signed-in/signed-out,
restart, classic↔AI, offline, stale, unavailable, and retry. Verify the exact
target survives, current authorization is rechecked, classic/AI share one cart,
and no pre-checkout CRM row exists. Record findings as
`internal evaluation only`.
