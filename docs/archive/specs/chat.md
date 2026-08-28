# Spec: chat

> Status: Living.
> Active surface: none.
> Density beyond the declared slice is intent, not contract; do not treat unimplemented sections as frozen.
> Last approved draft: owner, 2026-08-17.
> Written against blueprint §1, §2.1 (invariant 5), §3, §5, §7.1; scope §1.1,
> §2, §7; ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0016,
> ADR-0018; `docs/specs/core.md`, `docs/specs/db.md`,
> `docs/specs/contract.md`, `docs/specs/orders.md`,
> `docs/specs/companies-foundation.md`; `docs/module-ownership.md`.
>
> **Owner-first launch (2026-08-19):** the first product release is the
> company panel (staff/AI). Customer cabinet, public storefront, consumer
> discovery, and the business-chat **platform** are **Deferred: customer
> expansion** — named capabilities only, not a freeze and not launch work.
> Density beyond the named owner-first / phase-1 slice is intent.
>
> **Phased scope:** this is the one chat module spec. Phase 1 implements only
> the order-card projection slice (`order_cards`, `chat.upsertOrderCard`,
> `chat.getOrderCard`, consumer `chat.order-card-updater`) — the consumer
> template for the order → outbox → projection reference slice. The
> conversation platform (tables §2.1–2.6 names, staff/customer message
> actions, realtime) is customer expansion and must not be implemented as
> owner-first launch work. Attaching cards to conversations is expansion
> (former phase 7) and is the only later slice allowed to migrate or
> supersede `order_cards`, by amending this Living remainder or a slice
> card. `/rework-spec` applies only after a surface is Active.

## 1. Purpose

The `chat` module owns the order-card **projection** (phase 1) and, in
customer expansion, company↔customer conversations and everything inside
them: messages, participants and read cursors, reactions, entity mentions,
and attachment links (file IDs only).

It explicitly does NOT own: order/payment/document domain state (it stores
IDs and subscribes to events — ADR-0011), file bytes/upload/download
authorization (`files`), customer master data (`customers`),
membership/RBAC (`companies`), push delivery (`notifications`), or the AI
assistant conversation (`assistant` — a different surface entirely).

Chat in v2 is **single-channel** (in-app only): Meta/Instagram/messenger
channels are dropped (scope §5). **Chat never creates CRM records**
(`company_customers` rows) — CRM creation is staff add, checkout, or
invite accept (ADR-0018 as amended by ADR-0028). `orders` does not know chat
exists.

Owner-first launch does not ship conversations. The owner records orders in
the panel; documents are shared by link/QR/print.

## 2. Owned tables

All in `packages/db/src/schema/chat.ts` (ADR-0014). Phase 1 creates only
`order_cards` (§2.7). Customer expansion adds the named tables in §2.1.
All db.md §3 conventions apply.

### 2.1 Deferred: conversation platform (customer expansion)

Named tables only — full columns/indexes return when that slice is specified
for build (`/spec` density rule). Do not create these in owner-first launch.

| Table | Intent |
| --- | --- |
| `conversations` | One thread per company↔customer relationship. v1 uniqueness `(company_id, customer_user_id)` is the starting intent; do not invent group-chat here |
| `conversation_participants` | Per-user read cursors and notification flags; roles `customer` \| `staff` |
| `messages` | Per-conversation gapless `sequence`; soft delete; `sender_type` `customer` \| `staff` |
| `message_attachments` | File IDs only; bytes owned by `files` |
| `message_reactions` | One reaction per user per message |
| `message_mentions` | Entity IDs only (no domain-state snapshot — ADR-0011) |

### 2.7 `order_cards` (phase-1 slice)

The consumer-template table. It stores `order_id` only — never status,
totals, or any other order attribute (ADR-0011; prohibitions). Customer
expansion may migrate or supersede it explicitly by amending this Living
remainder; `/rework-spec` applies only after that surface is Active.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `order_id` | `uuid NOT NULL` | Unique; FK → `orders.id` `ON DELETE CASCADE` | The only domain reference |
| `revision` | `integer NOT NULL` | Default `1` | Bumped once per applied (non-duplicate) order event; exists so tests and realtime can observe projection updates without domain state |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:** unique `(order_id)`; `(company_id, updated_at DESC)`.

Clients render a card by reading `order_id` here and fetching authoritative
state through `orders.get` (staff) or, in customer expansion, the customer
order read — the projection never answers "what is the order's status".

## 3. Actions

### 3.1 Phase-1 slice (owner-first / reference)

#### `chat.getOrderCard`

| Field | Value |
| --- | --- |
| Name | `chat.getOrderCard` |
| Description | Get this company's order-card projection row for an order. Returns only projection metadata; fetch order state via `orders.get`. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ orderId: z.string().uuid() }` |
| Output | `{ id: z.string().uuid(), orderId: z.string().uuid(), revision: z.number().int(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() }` |
| Permissions | `["chat:view"]` |
| aiExposure | `internal` (exposed AI surface arrives with order collaboration in customer expansion) |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `2_000` |
| Calls (`ctx.call`) | none |

#### `chat.upsertOrderCard`

| Field | Value |
| --- | --- |
| Name | `chat.upsertOrderCard` |
| Description | Internal projection updater: materialize or touch the order card for an order lifecycle event. Not user-invokable. |
| Principal | `system` |
| Transport | `internal` |
| System scope | `tenant` (from the event envelope's `companyId`) |
| Input | The core event envelope (core.md §6) for `orders.created` \| `orders.confirmed`, payload validated against the orders spec §4.1 shapes |
| Output | `{ orderCardId: z.string().uuid(), revision: z.number().int(), applied: z.boolean() }` |
| Permissions | `[]` |
| aiExposure | `internal` |
| risk | `write` |
| requiresConfirmation | `false` |
| Idempotent | `true` — key: the delivering event ID via the `event_deliveries` reservation (core.md §6: the unique delivery row is the idempotency reservation; no second `idempotency_keys` row) |
| Emits | `[]` |
| Audit | `true` |
| auditTarget | `{ type: "order_card", id: <card id> }` |
| Timeout | `5_000` |
| Calls (`ctx.call`) | none |

Behavior: insert the card if absent (`ON CONFLICT (order_id)` upsert),
otherwise bump `revision`. Works for either event without inspecting domain
payload beyond `orderId` — tolerant of replays and of a missing card on
`orders.confirmed` (defensive upsert), even though core's per-aggregate
ordering means `orders.created` is normally applied first. Card upsert,
delivery transition to `processed`, and the audit row commit in one
transaction.

Phase 1 implements these two actions plus the consumer; it does not create
conversations or messages.

### 3.2 Deferred: conversation platform (customer expansion)

Permissions (when built): `chat:view` (read + mark read), `chat:respond`
(staff mutations). Do not implement these actions in owner-first launch.

**Staff (`principal: staff`):** `chat.listConversations`,
`chat.getConversation`, `chat.listMessages`, `chat.startConversation`,
`chat.sendMessage`, `chat.editMessage`, `chat.deleteMessage`,
`chat.setReaction`, `chat.markRead`, `chat.setConversationStatus`,
`chat.assignConversation`.

**Customer (`principal: customer`, typed `resolveTarget`):**
`chat.getMyConversation`, `chat.listMyMessages`, `chat.openMyConversation`,
`chat.sendMyMessage`, `chat.editMyMessage`, `chat.deleteMyMessage`,
`chat.setMyReaction`, `chat.markMyRead`. Intent: per-company cabinet, no
unified inbox; any authenticated user may open a thread with a published
company; chat never creates CRM rows (ADR-0018).

**System:** `chat.publishRealtimeUpdate`, `chat.getMessageContext`,
`chat.ensureConversationFromInvite`.

## 4. Events

### 4.1 Phase-1 consumed

| Event | Consumer | Bound action |
| --- | --- | --- |
| `orders.created` (v1) | `chat.order-card-updater` | `chat.upsertOrderCard`. One stable consumer name for both events; `event_deliveries` dedup on `(consumer, eventId)` makes redelivery a no-op (core.md §6) |
| `orders.confirmed` (v1) | `chat.order-card-updater` | `chat.upsertOrderCard` — same consumer |

### 4.2 Deferred emitted (customer expansion)

Named only. Payloads must never contain message content (NFR when specified).
`chat.conversationStarted`, `chat.messageSent`, `chat.messageEdited`,
`chat.messageDeleted`, `chat.reactionChanged`, `chat.conversationRead`,
`chat.conversationStatusChanged`, `chat.conversationAssigned`.

Deferred consumers: `chat.realtime-publisher` → `chat.publishRealtimeUpdate`;
`chat.invite-conversation-creator` → `chat.ensureConversationFromInvite`
(needs `invites.accepted`).

### 4.3 Read-model grants

None granted.

## 5. Concurrency

### 5.3 `order_cards` (phase-1 slice)

No status machine. Core's per-aggregate delivery ordering and the
transaction-scoped `(consumer, aggregate)` advisory lock (core.md §6)
serialize events of one order; the `(order_id)` unique constraint plus
upsert make concurrent first-materialization safe.

Conversation status machines, gapless `last_sequence` locks, and Socket.IO
rooms are customer expansion — specify at that slice, do not implement now.

## 6. Edge cases

**Order-card projection (phase-1 slice).**

- Redelivered `orders.created` / `orders.confirmed`: delivery dedup →
  handler not re-run; `revision` unchanged (`eventSuite`).
- `orders.confirmed` with no existing card (replayed after a parked/dead
  `orders.created` delivery): defensive upsert creates the card; when
  the created-event delivery is later replayed, dedup makes it a no-op.
- Cross-tenant event scope: the system context is scoped to the event's
  `companyId`; a card can only be written for that company. Card rows
  never leak order data.
- Order deleted (launch-migration edge; no v2 delete action exists):
  FK CASCADE removes the card; a dangling projection is impossible.
- Dead delivery: after 5 attempts the delivery parks for this consumer
  and alerts; payments' consumption of the same event is not blocked
  (core.md §6). Replay is the admin CLI.

Conversation edge cases (drafts, block, any-auth open, presence, attachment
scope) return when the platform slice is specified for build.

## 7. v1 migration notes

Phase 1 does not migrate v1 chat tables. `order_cards` is v2-new (ADR-0011);
no launch backfill of cards for pre-migration orders — expansion decides
backfill when cards attach to conversations.

Customer expansion must TRANSFORM web-channel `conversations` / `messages` /
participants / reactions / mentions (auth-mapped user IDs; drop Meta
channels and `entity_snapshot`). Until that slice is specified for build,
treat the v1 matrix rows as deferred, not owner-first schema work.

## 8. Acceptance criteria

Mandatory minimum (phase-1 slice):

- [ ] Cross-tenant isolation on `chat.getOrderCard` (`crossTenantSuite`):
      other-company order → `NotFoundError`.
- [ ] Authorization denial: missing `chat:view` → `PermissionDeniedError`.
- [ ] Validation failures are typed `ValidationError`.
- [ ] Outputs validate at runtime and are JSON-safe.
- [ ] Declared events emit transactionally (`eventSuite`).
- [ ] Audit rows for `chat.upsertOrderCard` with the declared target.
- [ ] **ADR-0011 schema check:** `order_cards` contains no order
      status/amount/state column (adding one fails review).
- [ ] **Order-card slice:** consuming `orders.created` materializes
      exactly one card per order (unique on `order_id`), inside the delivery
      transaction, with an audit row; `orders.confirmed` bumps `revision`;
      redelivery of either event is a no-op (no second card, no revision
      bump, no second audit row); confirmed-before-created replay still
      converges to one card; rollback of the delivery transaction leaves no
      card and no `processed` delivery row; `chat.upsertOrderCard` is
      unreachable via client transport, OpenAPI, and AI manifests; a dead
      delivery for `chat.order-card-updater` does not block the payments
      consumer of the same event.

Conversation-platform acceptance (gapless sequences, drafts, realtime,
openMyConversation, no CRM creation from chat) is customer expansion.

## 9. Resolved decisions

Resolved (owner, 2026-08-17), still binding for customer expansion:

1. No unified customer inbox. Cabinet chat is entered per company.
2. Any authenticated user may message any published company; chat never
   creates CRM records (ADR-0018).
3. Auto-create conversation on invite accept (needs `invites.accepted`).
4. Keep `draft` status.
5. `message_attachments`: chat owns join rows (file IDs only).
6. One chat spec — the phase-1 order-card slice lives in this file.

Resolved (owner, 2026-08-19):

7. Owner-first launch implements **only** the order-card slice. The
   conversation platform is customer expansion, not a drop.

Composition owed when the platform slice is built (not phase 1):
`customers.getCustomerOrderFacts`, `companies.getPublishedCompany`,
`companies.getMemberFacts`, `files.getAttachmentFacts`, `invites.accepted`.
Phase 1 has no `ctx.call` callees.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-19 | Slimmed to `/spec` density: full contract only for `order_cards` + `getOrderCard` / `upsertOrderCard` / `order-card-updater`. Conversation platform collapsed to named Deferred capabilities. Owner-first launch does not ship chat UI. | Owner-first launch; stop novelizing unimplemented phases | owner |
| 2026-08-17 | ADR-0018 rework: `openMyConversation` publication rule; no-CRM-creation guarantee. | ADR-0018 | spec-rework agent |
| 2026-08-17 | Approved. Slice absorbed from `chat-projection.md`; owner decisions. | Owner approval | owner |
| 2026-08-17 | Initial draft (conversation platform novel). | Phase-5 chat platform specification | spec agent |
