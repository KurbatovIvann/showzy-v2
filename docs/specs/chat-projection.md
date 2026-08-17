# Spec: chat order-card projection slice (phase 1)

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Written against blueprint §2.1 (invariant 5), §7.1 (stage 3b); scope §7
> (phase 1); ADR-0011, ADR-0013, ADR-0014, ADR-0015; `docs/specs/core.md`,
> `docs/specs/db.md`, `docs/specs/orders.md`; `docs/module-ownership.md`.
> This is a deliberately minimal phase-1 prerequisite, not the full chat
> module spec — the analogue of `companies-foundation.md` for the event
> consumption side of the order → outbox → chat projection reference slice.
> The full chat platform (conversations, participants, messages, reactions,
> realtime, attachments) is specified in phase 5; order collaboration in
> phase 6.

## 1. Purpose and boundary

This slice is the **consumer template**: it demonstrates how a projection
module subscribes to domain events, materializes a projection through an
internal idempotent tenant-scoped system action, survives redelivery, and
never copies authoritative domain state (ADR-0011). It owns exactly one
projection table and exposes one staff read used by tests and, later, by
card rendering. It does NOT create conversations or messages; phase 5/6
decides how order cards attach to conversations and migrates or supersedes
this table explicitly (recorded in the phase-5/6 chat spec, never silently).

## 2. Owned tables

`packages/db/src/schema/chat.ts` (ADR-0014) — this slice adds only:

### 2.1 `order_cards`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `order_id` | `uuid NOT NULL` | Unique; FK → `orders.id` `ON DELETE CASCADE` | The only domain reference. **No status, totals, or any other order attribute is ever stored here** (ADR-0011; prohibitions) |
| `revision` | `integer NOT NULL` | Default `1` | Bumped once per applied (non-duplicate) order event; exists so tests and realtime can observe projection updates without domain state |
| `created_at` | `timestamptz` | Default `now()` | |
| `updated_at` | `timestamptz` | Default `now()`, trigger-maintained | |

**Indexes:** unique `(order_id)`; `(company_id, updated_at DESC)`.

Clients render a card by reading `order_id` here and fetching authoritative
state through `orders.get` (staff) or the phase-4 customer read — the
projection never answers "what is the order's status".

## 3. Actions

### 3.1 `chat.upsertOrderCard`

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
otherwise bump `revision`. Works for either event without inspecting
domain payload beyond `orderId` — tolerant of replays and of a missing
card on `orders.confirmed` (defensive upsert), even though core's
per-aggregate ordering means `orders.created` is normally applied first.

### 3.2 `chat.getOrderCard`

| Field | Value |
| --- | --- |
| Name | `chat.getOrderCard` |
| Description | Get this company's order-card projection row for an order. Returns only projection metadata; fetch order state via orders.get. |
| Principal | `staff` |
| Transport | `client` |
| Input | `{ orderId: z.string().uuid() }` |
| Output | `{ id: z.string().uuid(), orderId: z.string().uuid(), revision: z.number().int(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() }` |
| Permissions | `["chat:view"]` |
| aiExposure | `internal` (exposed AI surface arrives with the phase-5 chat spec) |
| risk | `read` |
| requiresConfirmation | `false` |
| Idempotent | `false` |
| Emits | `[]` |
| Audit | `false` |
| Timeout | `2_000` |

## 4. Events

### 4.1 Emitted

None.

### 4.2 Consumed

| Event | Consumer | Bound action |
| --- | --- | --- |
| `orders.created` (v1) | `chat.order-card-updater` | `chat.upsertOrderCard` |
| `orders.confirmed` (v1) | `chat.order-card-updater` | `chat.upsertOrderCard` |

One stable consumer name for both events; `event_deliveries` dedup on
`(consumer, eventId)` makes redelivery a no-op (core.md §6).

### 4.3 Read-model grants

None granted and none used — this module reads only its own table; order
data is reached through orders read actions.

## 5. State machines and concurrency

No status machine. Concurrency: core's per-aggregate delivery ordering and
the transaction-scoped `(consumer, aggregate)` advisory lock (core.md §6)
serialize events of one order; the `(order_id)` unique constraint plus
upsert make concurrent first-materialization safe. Card upsert, delivery
transition to `processed`, and the audit row commit in one transaction.

## 6. Edge cases

1. **Redelivered event.** Delivery dedup → handler not re-run; `revision`
   unchanged (tested via `eventSuite`).
2. **`orders.confirmed` with no existing card** (e.g. replayed after a
   parked/dead `orders.created` delivery). Defensive upsert creates the
   card; when the created-event delivery is later replayed, dedup makes it
   a no-op.
3. **Cross-tenant event scope.** The system context is scoped to the
   event's `companyId`; a card can only be written for that company.
   `orders.get` from another company's staff for the same order fails —
   card rows never leak order data anyway.
4. **Order deleted (launch-migration edge; no v2 delete action exists).**
   FK CASCADE removes the card; a dangling projection is impossible.
5. **Dead delivery.** After 5 attempts the delivery parks for this consumer
   and alerts; payments' consumption of the same event is not blocked
   (core.md §6). Replay is the admin CLI.

## 7. v1 migration notes

`order_cards` is v2-new (born of ADR-0011); it has no v1 source and no
launch data migration — cards for pre-migration orders are not backfilled
in phase 1 (the phase-6 order-collaboration spec decides backfill when
cards attach to real conversations). The v1 chat tables (`conversations`,
`messages`, `conversation_participants`, `message_reactions`) and the
`message_mentions` REVIEW row stay with the phase-5 chat spec; this slice
authorizes no work on them. v1 `find_order_conversation` and the
conversation triggers remain mapped to phase 5/6 per the migration matrix.

## 8. Non-functional requirements

None beyond defaults. The table carries no PII and no money.

## 9. Acceptance criteria

- [ ] Consuming `orders.created` materializes exactly one card per order
      (unique on `order_id`), inside the delivery transaction, with an
      audit row.
- [ ] Consuming `orders.confirmed` bumps `revision` on the same card.
- [ ] Redelivery of either event is a no-op: no second card, no revision
      bump, no second audit row (`eventSuite`).
- [ ] Confirmed-before-created replay order still converges to one card
      (defensive upsert).
- [ ] Rollback of the delivery transaction leaves no card and no
      `processed` delivery row.
- [ ] Schema check: `order_cards` contains no order status/amount/state
      column; adding one fails review (prohibitions: projections store
      IDs).
- [ ] `chat.getOrderCard`: staff of another company gets `NotFoundError`
      (cross-tenant suite); missing `chat:view` → `PermissionDeniedError`;
      output validates at runtime.
- [ ] `chat.upsertOrderCard` is unreachable via client transport, OpenAPI,
      and AI manifests (`transport: internal`, contract spec §2).
- [ ] A dead delivery for `chat.order-card-updater` does not block the
      payments consumer of the same event.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Approved | Owner approval alongside the orders slice spec | owner |
| 2026-08-17 | Initial draft | Companion consumer-side spec for the phase-1 order → outbox → chat projection reference slice (orders spec §10.7) | spec agent |
