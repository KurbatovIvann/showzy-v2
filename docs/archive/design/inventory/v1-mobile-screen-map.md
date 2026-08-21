# V1 mobile screen map

> **Archived 2026-08-21.** ADR-0019 inventory. **Not visual acceptance.**
> Visuals and IA come from the Magic Patterns canvas (ADR-0024). This file
> is a historical map of V1 routes and edge cases. Agents may still read
> `E:\showzy\apps\mobile` for domain behavior.

> Status: Archived inventory from the ADR-0019 rebaseline.
> Source: `E:\showzy\apps\mobile` (read-only).
> Scope: mobile only; audited 2026-08-17.

## Scale

- 70 Expo Router files: about 49 leaf screens and 21 layouts.
- 218 files under `src/components/screens`.
- 101 client action modules, 33 React Query modules, 48 hooks, and 31
  Zustand stores.
- Ukrainian and English copy across 32 i18n namespaces.

Counts are inventory aids, not parity targets. A route is complete only when
its visible states and interactions are mapped.

## Canonical shells and routes

| Surface | Canonical routes | V2 disposition |
| --- | --- | --- |
| Boot | `/` | Adapt session/bootstrap logic; preserve transition behavior |
| Auth | `/(auth)/sign-in`, `verify` | Preserve UI; replace Supabase auth |
| Onboarding | intent, profile, verify contact, company, company profile/legal, FOP | Preserve and adapt to account/company actions |
| Customer tabs | Browse, Following, Orders, Profile, Messages | Preserve all five destinations |
| Company | `/company/[slug]`, products, checkout, delivery | Preserve public/auth handoff and commerce flow |
| Customer order | `/order/[id]` | Preserve own-order detail and cancellation |
| Chat | conversation, recap, product carousel | Preserve; rewrite transport and domain reads |
| Account | settings, phone/email/username changes, permissions | Preserve; add account deletion |
| Staff tabs | Orders, Products, Messages, Clients, More | Preserve permission-aware tabs |
| Staff hidden stacks | Documents, Settings | Preserve entry from More/related cards |
| Staff forms | Product, order, client, counterparty, invite, document | Preserve form/sheet behavior |
| Signing | `/sign/[documentId]` | Preserve on-device QES and human handoff |
| Shared overlays | Browser, image viewer, invite | Preserve presentations and deep-link entry |
| Dashboard/analytics | hidden dashboard route, coming-soon analytics row | Drop until useful analytics exists |

## Canonical journeys

1. Public browse → company → product feed → auth sheet → resume requested
   social/cart/chat action.
2. Authenticated browse → follow/like/comment → private Following collections.
3. Company → cart → checkout → Nova Poshta/pickup → order → redirect to chat.
4. Customer/staff inbox → conversation → order/document cards → recap.
5. Staff Orders/Products/Clients/Documents → list/detail/form sheets.
6. Invite/deep link → auth when required → resume target.
7. Document → prepare → local key/password → QES → upload result → card update.
8. Profile/More → choose one active company context; final interaction requires
   research while staying in the V1 design family.

## Navigation and presentation contract

- Customer glass tabs remain Browse, Following, Orders, Profile, Messages.
- Staff glass tabs remain Orders, Products, Messages, Clients, More.
- Company, order, account, forms, chat, recap, and invite use right-slide stack
  transitions with full-screen gestures.
- Browser and signing use form sheets; product carousel uses a page sheet;
  image viewer uses a 200 ms fade.
- Product card-to-feed shared-element motion, collapsible/floating headers,
  haptics, bottom sheets, keyboard handling, and chat micro-interactions are
  parity evidence.
- The AI entry is a contextual global overlay; it does not replace a tab.

## Required state inventory per screen

Every leaf-screen mapping must record:

- initial loading and skeleton;
- populated, empty, filtered-empty, and pagination states;
- validation and permission denial;
- offline/cached and reconnect states;
- optimistic mutation, retry, and server reconciliation;
- destructive confirmation and success feedback;
- deep-link/auth resume behavior;
- accessibility labels, focus, reduced motion, and keyboard behavior.

## Data-plane classification

- **Reuse**: route composition, presentational components, motion, local-only
  ephemeral state.
- **Adapt**: React Query hooks and screens whose props can bind to V2
  contracts without changing behavior.
- **Rewrite data**: all Supabase queries/RPC/storage, Nest `/api/v1`, legacy
  Socket.IO event assumptions, and auth session code.
- **Review product**: only items listed as research/defer in the approved
  conflict register.

No route may import a database client in V2. Company IDs and resource IDs are
selectors for typed target resolution, never access grants.

## P1 parity evidence

Golden screenshots and interaction recordings must cover:

- auth and both onboarding branches;
- Browse, company profile, product feed, Following, cart, checkout, delivery;
- customer orders and grouped unified inbox;
- chat text/media/voice/reactions/presence, order/document cards, recap;
- staff orders, products, clients/groups/counterparties/invites, documents;
- account settings, active-company selection, deep links, and QES;
- at least one classic-to-AI contextual handoff.
