# Web panel architecture (`apps/web`)

> Decision record: [ADR-0030](../adr/0030-web-panel-spa-and-deferred-storefront.md).
> UX source of truth: the web canvas (ADR-0024) and
> [`mapping/web-panel-chrome.md`](mapping/web-panel-chrome.md). This document
> maps that chrome onto a concrete client architecture; it is reference for
> the web feature cards, not a gate.

## Scope

`apps/web` is the **staff panel only**. The public storefront / consumer
surface is a separate later app (ADR-0030). The one public route in this
app is the document share landing `/d/:token`.

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Build | Vite + React, TypeScript strict | Base tsconfig from `@showzy/tooling` |
| Routing | TanStack Router (file-based) | Typed params + search params; `useBlocker` for dirty-form guards |
| Server state | TanStack Query v5 | Same conventions as `apps/mobile` |
| Forms | react-hook-form + Zod v4 resolvers | Schemas come from `@showzy/contract` |
| Styling | Tailwind CSS v4 | Canvas tokens are the theme source (see below) |
| Primitives | Selectively vendored shadcn/ui (Radix) | Only behavior-heavy: Dialog, DropdownMenu, Select, Popover, Tabs, Tooltip, Toast |
| Icons | lucide-react | Matches the canvas |
| Auth | better-auth React client | Phone/email OTP only (ADR-0006); browser cookie session |

No global state store. State lives in exactly three places: the URL
(navigation, selection, tabs, filters), TanStack Query (server data), and
local component state (form drafts, dialogs).

### Theme

Magic Patterns tokens (`canvas`, `surface`, `ink`, `muted`, `faint`, `line`,
`action`, `focus`, `danger`, soft variants) are the single theme source,
declared as CSS variables and mapped onto shadcn's semantic slots
(`canvas → background`, `surface → card`/`popover`, `ink → foreground`,
`line → border`, `action → primary`, `danger → destructive`). Vendored
shadcn components are reskinned to canvas classes on arrival; simple visual
components (buttons, status pills, nav rows, cards, form wrappers) are
ported from the canvas markup directly, without shadcn. Components are
added one by one, on demand — never the full kit.

## Communication with the API

The only data path is the typed oRPC client:

- `createContractClient` from `@showzy/contract` → `/rpc`. No hand-written
  fetch. `@showzy/contract/server` is forbidden in the bundle (existing
  `clientApp` ESLint boundary).
- **Tenant scope**: the active company comes from the URL slug, resolved
  against `companies.listMine`; the client then sets the `x-company-id`
  header via `setActiveCompany`. The slug/header is a selector — the server
  verifies membership (ADR-0013).
- **Queries**: key shape `[actionName, companyScope, input]`, mirroring
  `apps/mobile/src/api/query-options.ts`.
- **Mutations**: one `createMutationAttempt()` per logical submit (a single
  idempotency key reused across retries); `CONFIRMATION_REQUIRED` handled
  via `attempt.withChallenge(challengeId)`.
- **Errors**: discriminate on wire `error.code` via `isWireError`, never on
  message text. **Money**: `moneyToWire` / `moneyFromWire` only.

### Deployment topology

Static files behind a reverse proxy that also forwards `/rpc` and
`/api/auth` to the API — same-origin, so CORS never activates and
`SameSite=Lax` session cookies work unchanged. Dev uses the Vite proxy.
API-side prerequisite: the web origin joins better-auth `trustedOrigins`.

## Routing

The three-pane chrome maps onto nested routes: the list route renders the
list pane and an `Outlet` for the detail pane; child routes fill the detail
pane. Below the `md` breakpoint the route depth decides the visible pane
(index route → list, child route → detail; back returns to the list). This
replaces the prototype's in-memory `selectedId` state machine. Dirty-form
guards use the router blocker with the LeaveDialog from the canvas.

```
/sign-in                     auth: phone/email OTP entry
/verify                      auth: OTP code
/d/$token                    public share landing (no session)
/                            redirect → last company (prefs) or company picker

/$companySlug                layout: resolve slug via companies.listMine,
│                            set x-company-id, guard session
├─ orders                    list        ── $orderId │ new
├─ documents                 list (tab: issued)
│  ├─ $documentId            detail; ?share / ?sign drive the dialogs
│  ├─ new                    create-from-order; ?orderId= preset
│  └─ templates              list (tab: templates)
│     ├─ $templateId         detail
│     └─ $templateId/edit    full-shell takeover (template editor, T6)
├─ products                  list        ── $productId │ new │ $productId/edit
├─ customers                 list (tab: clients) ── $customerId │ new
│  ├─ groups                 tab         ── $groupId │ new
│  └─ counterparties         tab         ── $counterpartyId │ new
├─ invites                   list        ── $inviteId │ new
├─ pricing                   list        ── $priceListId │ new │ $priceListId/edit
└─ company                   list pane: Профіль / Реквізити / Команда
   ├─ legal
   └─ team
```

Conventions:

- **Search params are typed and validated** by the router: list search
  text, status/type filter chips, and dialog state (`?share=1`,
  `?sign=confirm`) — so every screen state is linkable and survives reload.
- **Tabs are routes** (documents/templates, customers/groups/
  counterparties), matching the chrome lock's list-pane tabs.
- **Full-shell takeovers** (template editor; future onboarding wizards) are
  ordinary routes that render outside the panel layout.
- The AI dock («Шозік») is a layout-level overlay, not a route.

## Folder structure

Mirrors `apps/mobile` so patterns transfer between clients:

```
apps/web/src/
  routes/            TanStack Router files — thin re-exports from features
  api/               contract-client provider, query-options, useContractMutation, errors
  auth/              better-auth client only (no screens)
  features/<area>/   orders, documents, products, customers, pricing,
                     company, invites, share, auth — each with
                     api/ list/ detail/ form/ shared/
  components/ui/     vendored primitives + panel chrome (PaneHeader,
                     DetailStage, StatusPill, LeaveDialog, …)
  theme/             CSS variables from canvas tokens
  prefs/             localStorage (last company slug, theme)
```

Import boundaries: `@showzy/contract`, `@showzy/validation`, `@showzy/ui`,
`@showzy/document-signing` only (enforced by the existing `clientApp`
ESLint rule). Never `core`, `db`, module packages, or `contract/server`.

## Testing

- Vitest + Testing Library (jsdom) for components/hooks; the `/rpc`
  boundary is mocked (msw), never module internals.
- Playwright smoke joins CI with the web phase (blueprint test row).
- Standard definition-of-done rules apply per feature card.
