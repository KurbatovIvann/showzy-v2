# V1 mobile component inventory

> **Archived 2026-08-21.** ADR-0019 inventory. **Not visual acceptance.**
> Shared primitives are built from the Magic Patterns canvas into
> `apps/mobile/src/components/ui/` (ADR-0024). This file is a historical
> V1 component map.

> Status: Archived inventory from the ADR-0019 rebaseline.
> Source roots are relative to `E:\showzy\apps\mobile\src`.

## Inventory summary

| Group | Approximate size | Default disposition |
| --- | ---: | --- |
| `components/ui` | 28 files | Reuse/adapt |
| `components/shell`, `components/glass` | 13 files | Reuse/adapt |
| `components/common`, onboarding, skeletons | 22 files | Reuse/adapt |
| `components/screens` | 218 files | Adapt |
| `hooks` | 48 files | Review boundary |
| `stores` | 31 files | Keep local-only state; rewrite server state |
| `lib/actions` | 101 files | Rewrite |
| `lib/react-query` | 33 files | Rewrite query functions; preserve UX policies |

## Reusable foundations

- Controls: button, icon button, input, OTP/phone input, form field/group,
  toggle, segmented control, quantity controls.
- Content: avatar/company avatar, badge, card, menu card/row, empty state,
  skeleton, animated list.
- Overlays: bottom sheet, searchable picker sheet, portals, image viewer,
  in-app browser.
- Shell: screen page shell, glass/floating headers, searchable header,
  customer/staff glass tab bars.
- Theme behavior: Unistyles, light/dark/system mode, MMKV preference.

Reuse means preserving public props and behavior where practical, not copying
legacy imports or bypassing V2 package boundaries.

## Feature component groups

| Domain | Canonical components | Disposition |
| --- | --- | --- |
| Browse | company cards, filters, search header, skeletons | Adapt to public/consumer search contracts |
| Following | followed company and liked product collections | Adapt to account reads |
| Company | profile header, product cards/feed, image carousel, comments, cart sheet | Preserve visual/gesture behavior |
| Checkout | contact, comment, payment, delivery, summary sheets | Adapt to cart/order/delivery actions |
| Orders | customer list/detail and staff list/detail/forms | Adapt; order domain remains source of truth |
| Chat | conversation lists, bubbles, input, attachments, voice, reactions, presence | Preserve UX; rewrite realtime/transport |
| Chat cards | order provider/sheets/actions, document cards | Read IDs/revisions and typed domain actions |
| Recap | orders, products, images, files, voice, documents tabs | Compose typed domain reads |
| Staff catalog | product/category lists, detail, forms, media | Adapt to catalog/files/pricing |
| Staff clients | customers, groups, counterparties, invites | Adapt to customers/invites |
| Documents | list/detail/form, order/agreement/counterparty pickers | Adapt to document modules |
| Signing | document signing screen and download/share | Preserve device-bound QES |
| Account | profile, contact/username changes, permissions | Adapt; add deletion flow |

## State ownership rules

Keep Zustand/local state only for ephemeral UI concerns such as:

- open sheets, draft forms, image viewer, product transition measurements;
- current search controls before submission;
- local cart interaction before synchronized action completion;
- upload progress, voice recording, theme, and active navigation context.

Server-owned entities, permissions, counters, unread state, order state, and
document/signature state come from actions/events and query cache. They are
not duplicated as authoritative Zustand state.

## Mandatory dependency removal

The V2 component tree must contain no direct use of:

- `@supabase/supabase-js`, `.from`, `.rpc`, or Supabase Storage;
- V1 Nest `/api/v1` clients;
- V1 `@showzy/database` or legacy shared DB types;
- legacy permission/session facts accepted without V2 verification;
- order/payment/document snapshots embedded as chat-owned state.

Socket.IO remains an implementation choice for realtime, but clients consume
the V2 chat protocol and event envelopes rather than V1 event shapes.

## Adaptation boundary

Feature screens receive contract-derived view models and callbacks. Domain
decisions stay in actions/services. In particular:

- social mutations set desired state and reconcile optimistic UI;
- public/auth handoff resumes the requested action;
- personalized prices never overwrite public or historical snapshots;
- stock is revalidated atomically at order confirmation;
- QES preparation/finalization uses actions while key processing stays local;
- AI navigation/prefill tools call the same callbacks/actions as classic UI.

## Acceptance per component

A component is parity-ready when:

1. layout, density, states, gestures, and motion match its V1 reference;
2. light/dark/system and Ukrainian/English work;
3. touch targets, labels, focus, contrast, and reduced motion pass the V2
   accessibility baseline;
4. no legacy data dependency remains;
5. loading/error/offline behavior is explicit;
6. tests cover reusable behavior and the owning screen covers integration.
