# Showzy V2 — Information Architecture

> Status: Complete; pending DEFINE Approval #2  
> Linear: SHO-9 · Stage: DEFINE  
> Evidence: approved constraints, desk research, and internal assumptions only

## Purpose

This document defines launch navigation and screen hierarchy for the single
Showzy Expo app. It constrains journeys and prototypes without defining
backend contracts or claiming external validation.

The app has three explicit contexts:

1. **Consumer discovery** — authenticated, global, no company scope.
2. **Staff workspace** — one company where the user has verified membership.
3. **Customer workspace** — one company the user is interacting with as a
   customer.

A user may hold several roles across companies. Every screen and consequential
action makes the active role, company, object, and effect visible. Routes,
links, notifications, remembered state, slugs, and IDs select an intended
target; they never grant access.

## Structural rules

- One account session and one context-aware app shell.
- Staff and customer contexts for the same company are separate destinations.
- Classic UI, AI, business chat, notifications, and links open the same
  authorized domain object.
- Order/document cards retain stable IDs and fetch current domain state.
- Company context changes are explicit, not hidden detail-page transitions.
- Business chat is distinct from AI chat in authorship, scope, and history.
- Chat supports collaboration; classic detail screens own dense review,
  structured editing, confirmation, and legal actions.
- Changing company or role invalidates unconfirmed actions and AI proposals.

## App shell

Authenticated screens provide:

- A context control showing Global, Staff, or Customer.
- Company identity and role on every company-scoped screen.
- Notification access and current degraded/offline state.
- Company cart access where applicable.
- Context-specific bottom navigation with Assistant in the center.

Full-screen forms and confirmations may hide tabs, but their header retains
role/company identity and a safe exit.

### Context switcher

The switcher groups:

- **Discover Showzy** — global consumer context.
- **Workspaces** — verified staff memberships.
- **Customer spaces** — companies resolvable from the user's current
  company-scoped journey or owned objects.
- **Account actions** — create a company, process an invite, sign out.

Each company entry includes the role. If both roles exist for one company, two
entries appear. A switch:

- Closes company overlays.
- Invalidates unconfirmed mutations.
- Never carries carts, customers, targets, or AI proposals across companies.
- Preserves only drafts explicitly keyed to their original context.
- Warns before discarding unsaved work.
- Announces the destination role and company accessibly.

## Default navigation

### Consumer discovery

1. **Discover** — search, category browse, results.
2. **Contexts** — role/company destinations; never a social follow list.
3. **Assistant** — global discovery and navigation.
4. **Notifications** — durable cross-context notification history.
5. **Account** — identity, devices, language, accessibility, security.

Discover is the default when no safe restorable intent or explicit workspace
preference exists.

### Staff workspace

1. **Home** — needs-attention queues and shortcuts.
2. **Orders** — status-grouped operational work.
3. **Assistant** — one-company staff scope.
4. **Chat** — customer conversations and inbound triage.
5. **More** — catalog, pricing, customers, documents, analytics, team,
   company settings.

### Customer workspace

1. **Company** — profile, catalog, product, cart, checkout.
2. **Orders** — own orders and valid actions.
3. **Assistant** — one-company customer scope.
4. **Chat** — the company conversation.
5. **More** — documents, profile/requisites, saved delivery data, company
   information, return to discovery.

## Route hierarchy

Route names are design identifiers, not Expo Router or action names.

```text
App
├── Bootstrap
│   ├── Session and pending-intent restoration
│   ├── Required update / service unavailable
│   └── Offline launch
├── Authentication
│   ├── Welcome / sign in / OTP
│   ├── Restore pending intent
│   └── Authentication error / sign out
├── Public link preview
│   ├── Published company
│   ├── Active published product
│   └── Unavailable target / open app / sign in
├── Consumer discovery
│   ├── Discover
│   │   ├── Search / categories / filters
│   │   ├── Company and product results
│   │   └── No results / unavailable / offline cache
│   ├── Contexts
│   │   ├── Staff workspaces / customer spaces
│   │   ├── Recently opened published companies
│   │   └── Create company / process invite
│   ├── Global assistant
│   │   ├── Conversation / result cards
│   │   └── Company transition / history
│   ├── Notifications
│   │   ├── List / grouped detail
│   │   └── Settings
│   └── Account
│       ├── Profile / language / accessibility
│       ├── Devices / notifications / sessions
│       └── Help / legal / sign out
├── Staff company
│   ├── Home
│   │   └── Operational summary / needs-attention / quick actions
│   ├── Orders
│   │   └── List / filters / detail / history / actions / conversation
│   ├── Staff assistant
│   │   └── Scope / proposal / prepared form / handoff / history
│   ├── Chat
│   │   └── Queues / conversation / attachments / card destinations
│   └── More
│       ├── Catalog
│       │   └── Categories / products / variants / media / publication
│       ├── Pricing
│       │   └── Personal / customer / group / default / effective price
│       ├── Customers
│       │   └── List / detail / groups / legal profile / invites
│       ├── Documents
│       │   └── List / detail / generation / QES / PDF / recovery
│       ├── Simple analytics
│       ├── Team and access
│       └── Company profile / publication / requisites / settings
├── Customer company
│   ├── Company
│   │   └── Profile / catalog / product / cart / checkout → chat
│   ├── Orders
│   │   └── List / detail / history / valid action / conversation
│   ├── Customer assistant
│   │   └── Scope / proposal / classic handoff / history
│   ├── Chat
│   │   └── Conversation / attachments / card destinations
│   └── More
│       └── Documents / profile / delivery / company info / discovery
└── Guarded destinations
    ├── Notification / invite / direct-link resolver
    ├── Order / conversation / document resolver
    ├── QES callback resolver
    └── Access denied / unavailable / safe fallback
```

## Discovery → company transition

A result contains recognition data only: company/product identity, category,
safe summary, image, location/service area where specified, and valid display
price where meaningful. It excludes likes, followers, comments, popularity,
and unsupported verification.

Opening a full profile invokes a separately authorized company-scoped
`customer` or `public` read. The shell changes visibly from global discovery to
`Customer · <company>` or a limited public preview. Profile, browsing, cart,
and chat create no CRM row. Checkout/order creation atomically links or
creates the CRM customer.

## Authentication and intent restoration

Authentication is required for global discovery, notifications, invites,
staff workspaces, owned objects, order placement, and QES signing. A direct
link may expose a limited published preview before sign-in.

Pending intent may contain destination type, opaque reference/token, source,
intended context, non-authoritative local cart/form state, and expiry. It never
contains authority or QES key material.

After install/sign-in, the app:

1. Restores the destination.
2. Resolves the account.
3. Rechecks expiry, publication, membership, ownership, and permission.
4. Selects or asks for the authorized role/company context.
5. Fetches current state.
6. Continues or shows a specific safe failure.

Invite acceptance follows the normative ADR-0018 CRM rule: it may establish a
resolvable company context but creates no CRM row. ADR-0018's contradictory
introductory wording must be reconciled before invite implementation.

## AI placement and handoffs

Assistant scope is always visible:

- Global discovery.
- Staff · one company.
- Customer · one company.
- Temporary object scope: product, cart, order, customer, conversation, or
  document.

AI receives stable references and current authorized context, not copied
domain state. It may navigate, explain, compare, or prefill. Dense review,
high-risk work, document generation confirmation, deletion, payment effects,
and QES signing open a human-controlled classic surface. Returning to AI
refreshes current state before reporting an outcome.

AI action states are Preparing, Ready for review, Awaiting confirmation,
Running, Completed, Partially completed, Failed, Retry available, or
Cancelled. A context switch cancels a pending proposal.

## Staff home and notifications

Staff Home prioritizes:

1. Failed/legal/irreversible work needing recovery.
2. Work blocking another person.
3. Orders needing action.
4. Document/signature tasks.
5. New inbound conversations.
6. Pending asynchronous operations.
7. Informational unread updates.

Each card explains queue membership and offers one dominant next action.

The notification center is durable; push is transport. Notifications name
company, role, object, and event, then open a guarded destination and refresh
state. Direct communication and action/legal events may push. Typing, reads,
visible-screen changes, and routine sync remain silent. Repeated events group
by conversation, order, document, or company.

## State and offline model

Every applicable screen defines loading, empty, no-results, validation,
permission, unavailable, expired/revoked, duplicate/already-complete, partial,
offline, retry, and unknown-failure states.

Offline may allow clearly dated previously authorized reads and local drafts.
Only actions whose later contracts guarantee safe replay may queue. Discovery
queries, checkout, lifecycle writes, permission/publication changes, document
generation, and QES signing are blocked without current authorization/state.

## Resolved DEFINE recommendations

1. Use the three five-tab navigation models above.
2. Separate Staff and Customer entries by role and company.
3. Use Global, company-role, and temporary object AI scopes.
4. Keep discovery results compact; put depth in the profile.
5. Authenticate global discovery; permit limited public direct-link preview.
6. Show effective price source on demand; Ukrainian labels remain unresolved.
7. Prioritize action/failure queues over broad dashboard metrics.
8. Push only direct communication or action/legal events; group repeats.
9. Default offline mutations to blocked unless safe replay is specified.
10. Distinguish AI, human, system, and domain cards and operation states.
11. Confirmation always names actor, company, target, effect, destination,
    reversibility, and consequence where applicable.
12. Distinguish unavailable, unpublished, deactivated, expired, revoked,
    unauthorized, and already-completed without leaking private existence.
13. Freeze Ukrainian terminology only after owner/reference-user review.
14. UX Gate evidence records artifact version, evaluator role, task, observed
    behavior, severity, disposition, unresolved risk, and
    `internal evaluation only`.

## Scope boundary

Launch includes mobile staff/customer/discovery, invoice-based payments,
catalog/pricing/customers/orders/chat, Nova Poshta delivery, default-template
documents, QES, notifications, simple analytics, and AI.

Do not add launch navigation for full web flows, acquiring/fiscalization,
banking/accounting, billing, company verification, workflow constructor,
DOCX, full event analytics, mobile template authoring, social mechanics,
anonymous discovery/orders, semantic discovery, Meta inbox, or restaurant
operations.

## Internal evaluation checklist

- Identify Global, Staff, or Customer and active company on every screen.
- Switch multi-role/multi-company context without carrying pending work.
- Find catalog, customers, orders, chat, documents, and settings.
- Preserve discovery/invite/direct-link intent through install/sign-in.
- Distinguish public preview from authenticated company context.
- Move classic ↔ AI without losing or duplicating the object/action.
- Reach current state from notification, chat card, and deep link.
- Recover from offline, stale, unavailable, and duplicate states.
- Confirm that profile/chat/cart create no CRM row.
- Confirm that no deferred or dropped feature appears as launch navigation.

Record findings as `internal evaluation only`.
