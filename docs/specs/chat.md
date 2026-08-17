# Spec: chat

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Written against blueprint §1, §2.1 (invariant 5), §3, §5, §7.1; scope §1.1,
> §2, §5, §7 (phases 1, 5, 6); ADR-0011, ADR-0012, ADR-0013, ADR-0014,
> ADR-0015, ADR-0016, ADR-0018; `docs/specs/core.md`, `docs/specs/db.md`,
> `docs/specs/contract.md`, `docs/specs/orders.md`,
> `docs/specs/companies-foundation.md`; `docs/module-ownership.md`.
>
> **Phased scope (mirrors `orders.md`):** this is the one chat module spec.
> Phase 1 implements only the order-card projection slice (`order_cards`,
> `chat.upsertOrderCard`, `chat.getOrderCard`, consumer
> `chat.order-card-updater`) — the consumer template for the order → outbox
> → chat reference slice. Phase 5 adds the chat platform (conversations,
> messages, reactions, attachments, realtime, presence). Phase 6 attaches
> order cards to conversations (redirect-to-chat, card messages,
> confirm/edit/cancel) and is the only phase allowed to migrate or supersede
> `order_cards`, via `/rework-spec`. The former companion file
> `chat-projection.md` was absorbed here (owner, 2026-08-17); slice behavior
> is unchanged.

## 1. Purpose

The `chat` module owns company↔customer conversations and everything inside
them: messages (with per-conversation gapless ordering), participants and
read cursors, reactions, entity mentions, attachment links (file IDs only),
and the order-card projection from the frozen slice. It explicitly does NOT
own: order/payment/document domain state (it stores IDs and subscribes to
events — ADR-0011), file bytes/upload/download authorization (`files`),
customer master data (`customers`), membership/RBAC (`companies`), push
delivery (`notifications`), or the AI assistant conversation (`assistant`,
phase 8 — a different surface entirely).

Chat in v2 is **single-channel** (in-app only): Meta/Instagram/messenger
channels and everything that existed for them (channels, external contacts,
external message IDs) are dropped with the v1 channels module (scope §5).
The conversation model is strictly 1:1 — one conversation per
`(company, customer user)` pair. Any authenticated user may open a
conversation with a **published** company (v1 behavior; no CRM link
required — ADR-0018). Existing conversations with companies that later
unpublish remain accessible. **Chat never creates CRM records**
(`company_customers` rows) — CRM creation happens only via staff action or
atomically at checkout (ADR-0018 §CRM customer creation). The
`company_customer_id` on conversations is nullable and set lazily when a CRM
row already exists; if the user later becomes a CRM customer (e.g., at
checkout), existing conversations can be backfilled. The customer cabinet is
**per-company** in V2: there is no unified cross-company inbox
(owner, 2026-08-17).

## 2. Owned tables

All in `packages/db/src/schema/chat.ts` (ADR-0014). Phase 1 creates only
`order_cards` (§2.7); phase 5 adds §2.1–2.6. All db.md §3 conventions apply
(`updated_at` via the shared trigger, text + CHECK statuses, `company_id`
tenancy).

### 2.1 `conversations`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Tenant root |
| `customer_user_id` | user id type | `NOT NULL`; FK → better-auth users `ON DELETE RESTRICT` | The stable customer identity. NOT NULL in v2 (no external contacts, no anonymous users) |
| `company_customer_id` | `uuid` | Nullable; FK → `company_customers.id` `ON DELETE SET NULL` | CRM link when one exists; nullable because any authenticated user may message a published company before becoming a CRM customer (ADR-0018). Set lazily at conversation creation only when a CRM row already exists; never created by chat. Backfilled when the user later becomes a CRM customer (e.g., at checkout or invite accept). Conversation survives CRM-record deletion via `customer_user_id` |
| `status` | `text NOT NULL` | Default `'active'`, CHECK `IN ('draft','active','archived','blocked')` | Transitions in §5.1. `draft` = customer opened chat but has not sent a message; invisible to staff |
| `assigned_to_user_id` | user id type | Nullable; FK → better-auth users `ON DELETE SET NULL` | Assigned company member |
| `customer_display_name` | `text NOT NULL` | | Snapshot of the customer's display name at conversation creation (from the acting user's profile, or from the invite/CRM name on auto-create). Staff hydration prefers live CRM `displayName` when `company_customer_id` is set; this column is the fallback for non-CRM chatters and deleted CRM records. Chat UX state, not a customers projection |
| `last_sequence` | `bigint NOT NULL` | Default `0` | Per-conversation gapless message counter, incremented in the send handler under the row lock (§5.2). Replaces the v1 global sequence |
| `last_message_at` | `timestamptz` | Nullable | Denormalized for list sorting |
| `last_message_preview` | `text` | Nullable | First 100 chars of the last non-deleted message; recomputed on delete/edit of the latest message (§7.10). Chat's own state — not an ADR-0011 concern |
| `last_message_content_type` | `text` | Nullable, CHECK `IN ('text','image','file','audio','product','system')` | Type-appropriate list preview labels (v1 behavior) |
| `last_message_sender_type` | `text` | Nullable, CHECK `IN ('customer','staff')` | List rendering ("you: …") |
| `company_unread_count` | `integer NOT NULL` | Default `0`, CHECK `>= 0` | Per-side counters (v1 model), maintained in handlers, never by trigger |
| `customer_unread_count` | `integer NOT NULL` | Default `0`, CHECK `>= 0` | |
| `created_at` / `updated_at` | `timestamptz` | db.md defaults | |

**Indexes:** unique `(company_id, customer_user_id)`;
`(company_id, last_message_at DESC NULLS LAST) WHERE status != 'draft'` —
panel list; `(customer_user_id)` — ownership lookups / `getMyConversation`
resolver; `(company_id, status)`; partial `(company_id) WHERE
company_unread_count > 0`. No customer-side list index: V2 has no unified
inbox.

### 2.2 `conversation_participants`

Read cursors and per-conversation notification preferences. Rows: the
customer row is created with the conversation; a staff row is upserted on
that member's first `chat.markRead`/assignment.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | |
| `conversation_id` | `uuid NOT NULL` | FK → `conversations.id` `ON DELETE CASCADE` | |
| `user_id` | user id type | `NOT NULL`; FK → users `ON DELETE CASCADE` | |
| `role` | `text NOT NULL` | CHECK `IN ('customer','staff')` | v1 `participant` value is not carried (unused in the 1:1 model) |
| `last_seen_sequence` | `bigint NOT NULL` | Default `0` | Monotonic read cursor (replaces v1 `last_seen_message_id`) |
| `last_seen_at` | `timestamptz` | Nullable | |
| `notifications_enabled` | `boolean NOT NULL` | Default `true` | Consumed by `notifications` via `chat.getMessageContext` |
| `created_at` / `updated_at` | `timestamptz` | db.md defaults | |

**Indexes:** unique `(conversation_id, user_id)`; `(user_id)`.

### 2.3 `messages`

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | |
| `conversation_id` | `uuid NOT NULL` | FK → `conversations.id` `ON DELETE CASCADE` | |
| `sender_user_id` | user id type | `NOT NULL`; FK → users `ON DELETE RESTRICT` | v2 has no senderless messages; `system` content is produced by internal actions with the acting system identity recorded in audit, sender = the accountable user where one exists (phase 6 defines this precisely) |
| `sender_type` | `text NOT NULL` | CHECK `IN ('customer','staff')` | Captured at send time (a user can be staff of one company and customer of another) |
| `content` | `text NOT NULL` | Default `''`, CHECK `char_length(content) <= 8000` | May be empty only for attachment/card messages (validated in the action, §3) |
| `content_type` | `text NOT NULL` | Default `'text'`, CHECK `IN ('text','image','file','audio','product','system')` | `system` is reserved (never client-settable; phase 6). `order` is added by the phase-6 rework |
| `sequence` | `bigint NOT NULL` | | Per-conversation, gapless, from `conversations.last_sequence` under the row lock |
| `reply_to_message_id` | `uuid` | Nullable; FK → `messages.id` `ON DELETE SET NULL` | Promoted from v1 `metadata.reply_to` |
| `edited_at` | `timestamptz` | Nullable | Set by `chat.editMessage` |
| `deleted_at` | `timestamptz` | Nullable | Soft delete; content is retained in the DB but masked on every output (§3) |
| `created_at` / `updated_at` | `timestamptz` | db.md defaults | |

**Indexes:** unique `(conversation_id, sequence)`; `(conversation_id,
sequence DESC) WHERE deleted_at IS NULL`; `(company_id, created_at)`;
`(sender_user_id)`.

v1 `metadata`/`channel_metadata` jsonb, `external_message_id`, `status`
(delivery state), and `sender_name` are not carried (§8).

### 2.4 `message_attachments`

Join rows storing **file IDs only**. Bytes, metadata, upload/finalization,
and download authorization belong to `files`; chat records which finalized
files a message references (owner decision §11.7).

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | |
| `message_id` | `uuid NOT NULL` | FK → `messages.id` `ON DELETE CASCADE` | |
| `file_id` | `uuid NOT NULL` | FK → files' attachment table `ON DELETE RESTRICT` | Cross-module FK per db.md §3; deleting a referenced file is blocked |
| `position` | `integer NOT NULL` | Default `0` | Display order |
| `created_at` | `timestamptz` | Default `now()` | Immutable rows, no `updated_at` |

**Indexes:** unique `(message_id, file_id)`; `(file_id)`.

### 2.5 `message_reactions`

One reaction per user per message (v1 final behavior after
`20260319000001`).

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | Added vs v1 for tenant-scoped queries |
| `message_id` | `uuid NOT NULL` | FK → `messages.id` `ON DELETE CASCADE` | |
| `user_id` | user id type | `NOT NULL`; FK → users `ON DELETE CASCADE` | |
| `emoji` | `text NOT NULL` | CHECK `char_length(emoji) BETWEEN 1 AND 16` | |
| `created_at` | `timestamptz` | Default `now()` | |

**Indexes:** unique `(message_id, user_id)`; `(user_id)`.

### 2.6 `message_mentions`

Resolves the matrix `REVIEW` row (§8.6). Stores entity **IDs only** — the
v1 `entity_snapshot` jsonb (which held name/price/status) violates ADR-0011
and is dropped; clients render mention cards by fetching current state
through the owning module's read actions.

| Column | Type | Constraints / default | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `company_id` | `uuid NOT NULL` | FK → `companies.id` `ON DELETE CASCADE` | |
| `message_id` | `uuid NOT NULL` | FK → `messages.id` `ON DELETE CASCADE` | |
| `entity_type` | `text NOT NULL` | CHECK `IN ('product','order','customer')` | Phase 5 send path produces `product` only; `order`/`customer` values exist for migrated v1 rows and the phase-6 rework |
| `entity_id` | `uuid NOT NULL` | No FK — a mention must survive entity deletion (renders as unavailable) | |
| `start_index` / `end_index` | `integer` | Nullable, CHECK `(both NULL) OR (start_index >= 0 AND end_index > start_index)` | NULL = card-style mention (v1 `20260310000001`) |
| `created_at` | `timestamptz` | Default `now()` | |

**Indexes:** `(message_id)`; `(company_id, entity_type, entity_id)`.

### 2.7 `order_cards` (phase-1 slice)

The consumer-template table. It stores `order_id` only — never status,
totals, or any other order attribute (ADR-0011; prohibitions). Phase 5 does
not attach it to conversations; phase 6 may migrate or supersede it
explicitly via `/rework-spec`.

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
state through `orders.get` (staff) or the phase-4 customer read — the
projection never answers "what is the order's status".

## 3. Actions

Permissions carry over from v1 unchanged: `chat:view` (read + mark read),
`chat:respond` (every staff mutation). Shared output shapes (wire types per
contract.md; `sequence` is `z.number().int()` — per-conversation message
counts stay far below 2^53):

```ts
const ConversationCore = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  customerUserId: z.string(),
  companyCustomerId: z.string().uuid().nullable(),
  status: z.enum(["draft", "active", "archived", "blocked"]),
  assignedToUserId: z.string().nullable(),
  customerDisplayName: z.string(),
  lastSequence: z.number().int(),
  lastMessageAt: z.string().datetime().nullable(),
  lastMessagePreview: z.string().nullable(),
  lastMessageContentType: z
    .enum(["text", "image", "file", "audio", "product", "system"])
    .nullable(),
  lastMessageSenderType: z.enum(["customer", "staff"]).nullable(),
  unreadCount: z.number().int(), // the caller's side of the two counters
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Staff outputs add hydrated customer facts when a CRM link exists:
const StaffConversation = ConversationCore.extend({
  customer: z
    .object({ displayName: z.string() })
    .nullable(), // null when no CRM link (or it was deleted); UI falls back to customerDisplayName
});

// Customer outputs add hydrated company facts (ctx.call → companies):
const MyConversation = ConversationCore.omit({
  customerUserId: true,
  companyCustomerId: true,
  assignedToUserId: true,
  customerDisplayName: true,
}).extend({
  company: z.object({ name: z.string(), slug: z.string(), logoFileId: z.string().uuid().nullable() }),
});

const Message = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderUserId: z.string(),
  senderType: z.enum(["customer", "staff"]),
  content: z.string(),            // "" when deletedAt != null (masked)
  contentType: z.enum(["text", "image", "file", "audio", "product", "system"]),
  sequence: z.number().int(),
  replyToMessageId: z.string().uuid().nullable(),
  attachments: z.array(z.object({ fileId: z.string().uuid(), position: z.number().int() })), // [] when deleted
  mentions: z.array(z.object({
    entityType: z.enum(["product", "order", "customer"]),
    entityId: z.string().uuid(),
    startIndex: z.number().int().nullable(),
    endIndex: z.number().int().nullable(),
  })),
  reactions: z.array(z.object({ emoji: z.string(), userIds: z.array(z.string()) })),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

const SendMessageInput = z.object({
  conversationId: z.string().uuid(),
  content: z.string().max(8000).default(""),
  contentType: z.enum(["text", "image", "file", "audio", "product"]).default("text"),
  attachments: z.array(z.object({ fileId: z.string().uuid() })).max(10).default([]),
  mentions: z.array(z.object({
    entityType: z.literal("product"),      // phase-5 send path
    entityId: z.string().uuid(),
    startIndex: z.number().int().nullable(),
    endIndex: z.number().int().nullable(),
  })).max(20).default([]),
  replyToMessageId: z.string().uuid().optional(),
});
```

Shared send validation (both principals): non-empty `content` OR ≥1
attachment OR ≥1 mention (`ValidationError` otherwise); `image|file|audio`
require ≥1 attachment; `product` requires ≥1 product mention; `system` is
not accepted from clients; `replyToMessageId` must reference a message of
the same conversation; every attachment `fileId` must resolve via
`ctx.call` to `files` as finalized, uploaded by the sender, and scoped to
this company+conversation (§12) — otherwise `NotFoundError`.

### 3.1 Staff actions (panel)

All staff actions: `transport: client`, `requiresConfirmation: false`,
tenant scope from verified membership. Reads: `risk: read`,
`aiExposure: exposed`, `idempotent: false`, `emits: []`, `audit: false`,
timeout `2_000`. Writes: `risk: write`, `idempotent: true` (client key via
`createMutationAttempt()`, scope `company:<companyId>`, conflict per core.md
§5), `audit: true`, timeout `5_000`.

| Action | Description (AI instruction) | Permissions | aiExposure | Input → Output | Emits | auditTarget | Calls (`ctx.call`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `chat.listConversations` | List this company's conversations, newest activity first. Draft conversations are excluded — a draft is invisible until the customer sends the first message. | `["chat:view"]` | `exposed` | `{ status?: z.enum(["active","archived","blocked"]), cursor?: z.string(), limit: z.number().int().min(1).max(50).default(20) }` → `{ items: z.array(StaffConversation), nextCursor: z.string().nullable() }` | `[]` | — | `customers.getCustomerOrderFacts` (batch hydration of display names, §12) |
| `chat.getConversation` | Get one conversation of this company by ID (drafts excluded). | `["chat:view"]` | `exposed` | `{ conversationId: z.string().uuid() }` → `StaffConversation` | `[]` | — | same |
| `chat.listMessages` | List messages of a conversation by sequence. Use `beforeSequence` to page history and `afterSequence` to fetch the delta after reconnect. | `["chat:view"]` | `exposed` | `{ conversationId: z.string().uuid(), beforeSequence?: z.number().int(), afterSequence?: z.number().int(), limit: z.number().int().min(1).max(100).default(50) }` → `{ items: z.array(Message), lastSequence: z.number().int() }` | `[]` | — | none |
| `chat.startConversation` | Get or create the conversation with a CRM customer of this company. The customer must have a linked Showzy account. Created conversations are `active`. | `["chat:respond"]` | `exposed` | `{ customerId: z.string().uuid() }` → `StaffConversation` | `["chat.conversationStarted"]` (only when created) | `{ type: "conversation", id }` | `customers.getCustomerOrderFacts` (tenant check + linked `userId`; `null` user → `ConflictError`) |
| `chat.sendMessage` | Send a message to a customer in this conversation. Fails if the conversation is blocked. | `["chat:respond"]` | `exposed` | `SendMessageInput` → `Message` | `["chat.messageSent"]` | `{ type: "message", id }` | `files.getAttachmentFacts` (attachment validation, §12) |
| `chat.editMessage` | Edit the text of a message you sent. Only the sender can edit; deleted messages cannot be edited. | `["chat:respond"]` | `internal` | `{ messageId: z.string().uuid(), content: z.string().min(1).max(8000) }` → `Message` | `["chat.messageEdited"]` | `{ type: "message", id }` | none |
| `chat.deleteMessage` | Delete (soft) a message you sent. Content is hidden from both sides. | `["chat:respond"]` | `internal` | `{ messageId: z.string().uuid() }` → `Message` | `["chat.messageDeleted"]` | `{ type: "message", id }` | none |
| `chat.setReaction` | Set or clear your emoji reaction on a message (one reaction per user per message; `emoji: null` clears). | `["chat:respond"]` | `exposed` | `{ messageId: z.string().uuid(), emoji: z.string().min(1).max(16).nullable() }` → `{ messageId, reactions: Message.shape.reactions }` | `["chat.reactionChanged"]` | `{ type: "message", id }` | none |
| `chat.markRead` | Mark the conversation read up to a sequence for the calling member; resets the company unread badge. | `["chat:view"]` | `exposed` | `{ conversationId: z.string().uuid(), lastSeenSequence: z.number().int().min(0) }` → `{ conversationId, lastSeenSequence: z.number().int() }` (the effective, monotonic cursor) | `["chat.conversationRead"]` | `{ type: "conversation", id }` | none |
| `chat.setConversationStatus` | Archive, unarchive, block, or unblock a conversation (transitions in §5.1). | `["chat:respond"]` | `exposed` | `{ conversationId: z.string().uuid(), status: z.enum(["active","archived","blocked"]) }` → `StaffConversation` | `["chat.conversationStatusChanged"]` | `{ type: "conversation", id }` | none |
| `chat.assignConversation` | Assign the conversation to a company member (or clear the assignment with `null`). | `["chat:respond"]` | `exposed` | `{ conversationId: z.string().uuid(), assigneeUserId: z.string().nullable() }` → `StaffConversation` | `["chat.conversationAssigned"]` | `{ type: "conversation", id }` | `companies.getMemberFacts` (assignee must be an active member, §12) |
| `chat.getOrderCard` | Get this company's order-card projection row for an order. Returns only projection metadata; fetch order state via `orders.get`. | `["chat:view"]` | `internal` (exposed AI surface arrives with phase-6 order collaboration) | `{ orderId: z.string().uuid() }` → `{ id: z.string().uuid(), orderId: z.string().uuid(), revision: z.number().int(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() }` | `[]` | — | none |

### 3.2 Customer actions (cabinet)

The V2 cabinet is entered **per company** (owner, 2026-08-17): there is no
`chat.listMyConversations`. The customer opens the company's chat via
`chat.openMyConversation` (get-or-create the single 1:1 conversation) and
reaches an existing thread from a push/deep link via
`chat.getMyConversation`. A unified cross-company inbox is deferred until
core gains a customer self-scope read (not requested in this spec).

All customer actions: `principal: customer`, `transport: client`,
`permissions: []`, authorization = typed `resolveTarget` (ADR-0013). The
conversation resolver loads the conversation by ID and proves
`customer_user_id = ctx.userId` (`NotFoundError` otherwise — no existence
leak). Metadata defaults mirror §3.1 (reads read/exposed/2s, writes
write/idempotent/audited/5s).

| Action | Description | Target resolution | Input → Output | Emits | Notes |
| --- | --- | --- | --- | --- | --- |
| `chat.getMyConversation` | Get one of your conversations by ID. | Conversation ownership | `{ conversationId }` → `MyConversation` | `[]` | Also the access proof `files` reuses via `ctx.call` for download authorization (§12) |
| `chat.listMyMessages` | List messages of your conversation (same paging as `chat.listMessages`). | Conversation ownership | as `chat.listMessages` | `[]` | |
| `chat.openMyConversation` | Open (get or create) your conversation with a company. Any authenticated user may message any published company; a CRM link is not required (ADR-0018). Existing conversations with companies that later unpublish remain accessible. New conversations start as `draft` until your first message. Chat never creates CRM records. | **Existing conversation** for `(companyId, userId)` → that row (ownership proven; accessible regardless of company publication status). **No row yet** → prove the company exists **and is published** via `call` `companies.getPublishedCompany` inside `resolveTarget` (§11 decision 8; ADR-0018 publication rule); `companyId` is a selector, never a grant. Exception: if the user already has a CRM record with the company (`company_customers` row exists), the publication check is skipped — existing relationships are not blocked by unpublishing | `{ companyId: z.string().uuid() }` → `MyConversation` | `["chat.conversationStarted"]` (only when created) | Idempotent get-or-create on unique `(company_id, customer_user_id)`. Sets `company_customer_id` only when a CRM row already exists at create time (optional `customers` read; `null` otherwise) — chat never creates CRM records (ADR-0018). If the user later becomes a CRM customer (e.g., at checkout), existing conversations are backfilled with `company_customer_id`. Captures `customer_display_name` from the caller's profile |
| `chat.sendMyMessage` | Send a message in your conversation. Fails if the company blocked the conversation. First message promotes `draft` → `active`. | Conversation ownership | `SendMessageInput` → `Message` | `["chat.messageSent", "chat.conversationStatusChanged"]` (status event only on draft promotion) | |
| `chat.editMyMessage` | Edit a message you sent. Only the sender can edit; there is no time window; deleted messages cannot be edited. | Conversation ownership + sender check | as `chat.editMessage` | `["chat.messageEdited"]` | |
| `chat.deleteMyMessage` | Delete (soft) a message you sent. Content is retained in the DB and masked on every output. | Conversation ownership + sender check | as `chat.deleteMessage` | `["chat.messageDeleted"]` | |
| `chat.setMyReaction` | Set or clear your reaction on a message in your conversation. | Conversation ownership (via message) | as `chat.setReaction` | `["chat.reactionChanged"]` | |
| `chat.markMyRead` | Mark your conversation read up to a sequence; resets your unread badge. | Conversation ownership | as `chat.markRead` | `["chat.conversationRead"]` | |

`aiExposure`: reads and `sendMyMessage`/`openMyConversation`/`setMyReaction`/
`markMyRead` `exposed`; edit/delete `internal` (as in §3.1).

### 3.3 System / internal actions

| Field | `chat.publishRealtimeUpdate` | `chat.getMessageContext` | `chat.ensureConversationFromInvite` |
| --- | --- | --- | --- |
| Description | Internal fan-out: publish a chat domain event to Socket.IO rooms (§6). Not user-invokable. | Internal read for notifications: message preview + recipients. Not user-invokable. | Internal: get-or-create the `active` conversation when a customer accepts an invite (v1 `20260407000002`). Not user-invokable. |
| Principal / transport | `system` / `internal` | `system` / `internal` | `system` / `internal` |
| System scope | `tenant` (event envelope `companyId`) | `tenant` | `tenant` |
| Input | Core event envelope for any §4.1 event | `{ messageId: z.string().uuid() }` | Core event envelope for `invites.accepted` (expected payload: `{ companyId, customerUserId, companyCustomerId, customerDisplayName }`; exact shape is owned by the invites spec) |
| Output | `{ published: z.boolean() }` | `{ conversationId, companyId, preview: z.string().max(120), contentType, senderUserId, senderType, recipients: z.array(z.object({ userId: z.string(), role: z.enum(["customer","staff"]), notificationsEnabled: z.boolean() })) }` | `{ conversationId: z.string().uuid(), created: z.boolean() }` |
| Permissions / aiExposure | `[]` / `internal` | `[]` / `internal` | `[]` / `internal` |
| risk | `write` (bound event consumer must be write/idempotent, core.md §6; the only DB effect is the delivery transition) | `read` | `write` |
| Idempotent | `true` — key: delivering event ID via the `event_deliveries` reservation. Redelivery re-publishes a frame; clients dedupe by `(conversationId, sequence)` / event ID (§6) | `false` | `true` — key: delivering event ID via `event_deliveries`. Unique `(company_id, customer_user_id)` is the domain backstop |
| Emits | `[]` | `[]` | `["chat.conversationStarted"]` (only when created) |
| Audit / auditTarget | `true` / `{ type: "conversation", id }` | `false` | `true` / `{ type: "conversation", id }` |
| Timeout | `5_000` | `2_000` | `5_000` |

`chat.getMessageContext` returns `NotFoundError` for deleted messages so a
push scheduled before deletion is skipped. Recipients: the customer
participant plus staff — the assigned member if set, otherwise all members
holding `chat:view` (member list via `ctx.call companies.getMemberFacts`,
§12) — minus the sender, honoring `notifications_enabled`. `preview` is
transient notification content and must not be persisted by consumers.

`chat.ensureConversationFromInvite`: insert `active` conversation + customer
participant if absent; if a draft/active conversation already exists, attach
`company_customer_id` (and refresh `customer_display_name` from the invite
when the current name is the generic fallback) without emitting a second
`conversationStarted`. Never unblocks a `blocked` conversation.

#### `chat.upsertOrderCard` (phase-1 slice)

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

`chat.getOrderCard` is the matching staff read (§3.1). Phase 1 implements
these two actions plus the consumer; it does not create conversations or
messages.

## 4. Events

### 4.1 Emitted

All envelope version `1`, `scope: "tenant"`, aggregate
`{ type: "conversation", id: conversationId }` (per-aggregate ordering gives
consumers in-order delivery per conversation, core.md §6). **Payloads never
contain message content** — realtime hydrates from the DB (§6), push
previews come from `chat.getMessageContext` at delivery time; the outbox is
retained forever and must not hold chat text (NFR §9).

| Event | Payload | Expected subscribers |
| --- | --- | --- |
| `chat.conversationStarted` | `{ conversationId, companyId, customerUserId, companyCustomerId: nullable, startedBy: "staff"\|"customer", status: "draft"\|"active" }` | realtime publisher; `notifications` (ignores drafts); `analytics` |
| `chat.messageSent` | `{ conversationId, messageId, companyId, senderUserId, senderType, contentType, sequence, attachmentCount, mentionedEntityIds: string[] }` | realtime publisher; `notifications` (push, phase-4/5 pattern); `analytics` (response-rate replaces v1 `analytics_response_rate`) |
| `chat.messageEdited` | `{ conversationId, messageId, sequence }` | realtime publisher |
| `chat.messageDeleted` | `{ conversationId, messageId, sequence }` | realtime publisher; `notifications` (cancel undelivered push if feasible) |
| `chat.reactionChanged` | `{ conversationId, messageId, userId, emoji: string\|null }` | realtime publisher |
| `chat.conversationRead` | `{ conversationId, userId, role: "customer"\|"staff", lastSeenSequence }` | realtime publisher (read receipts) |
| `chat.conversationStatusChanged` | `{ conversationId, from, to, changedBy: "staff"\|"customer" }` | realtime publisher |
| `chat.conversationAssigned` | `{ conversationId, assigneeUserId: string\|null }` | realtime publisher; `notifications` (notify assignee) |

### 4.2 Consumed

| Event | Consumer | Bound action |
| --- | --- | --- |
| `orders.created` (v1) | `chat.order-card-updater` | `chat.upsertOrderCard` (§3.3). One stable consumer name for both events; `event_deliveries` dedup on `(consumer, eventId)` makes redelivery a no-op (core.md §6) |
| `orders.confirmed` (v1) | `chat.order-card-updater` | `chat.upsertOrderCard` — same consumer |
| `chat.*` (all §4.1) | `chat.realtime-publisher` | `chat.publishRealtimeUpdate` (§6) |
| `invites.accepted` (expected from the invites spec) | `chat.invite-conversation-creator` | `chat.ensureConversationFromInvite` — auto-create the `active` conversation on invite accept (v1 `20260407000002`; owner, 2026-08-17). Blocked on the invites spec emitting this event; until then the consumer is specified but unbound |

### 4.3 Read-model grants

None granted. `search` (message FTS) is out of phase-5 scope; if the search
spec later wants chat content it must request a grant through `/rework-spec`
here.

## 5. State machines and concurrency

### 5.1 `conversations.status`

| From | To | Trigger |
| --- | --- | --- |
| `draft` | `active` | Customer's first `chat.sendMyMessage` (in the send transaction) |
| `active` | `archived` | `chat.setConversationStatus` (staff) |
| `archived` | `active` | staff; also automatic on any new message (either side) — v1 archived conversations resurface on activity |
| `active` / `archived` | `blocked` | staff |
| `blocked` | `active` | staff (unblock) |

Anything else → `ConflictError`. `draft` is reachable only via
`chat.openMyConversation`; `chat.startConversation` (staff) creates `active`
directly. In `blocked`: customer mutations (`sendMyMessage`, reactions,
edit/delete) → `ConflictError`; staff sends also → `ConflictError` (unblock
first); reads and `markRead` work for both sides.

### 5.2 Concurrency

- **Message ordering**: `sendMessage`/`sendMyMessage` take
  `SELECT ... FOR UPDATE` on the conversation row, increment
  `last_sequence`, insert the message with that sequence, and update
  preview/unread fields — one lock, gapless per-conversation sequences,
  no global Postgres sequence (v1's `conversation_message_seq` is not
  carried). Concurrent sends serialize; the unique
  `(conversation_id, sequence)` is the backstop.
- **Get-or-create races** (`startConversation` / `openMyConversation`):
  `ON CONFLICT (company_id, customer_user_id)` upsert-then-select; exactly
  one row wins, both callers get it, `chat.conversationStarted` is emitted
  only by the transaction that inserted.
- **Read cursors are monotonic**: `markRead` applies
  `GREATEST(existing, input)`; a stale/out-of-order call can never move a
  cursor backwards. Unread counters reset to the exact count of messages
  past the new cursor from the other side (not blindly to 0), so a message
  racing a markRead is not lost from the badge.
- **Edit/delete racing each other**: both lock the message row; edit of a
  deleted message → `ConflictError`.
- **Transaction boundary**: message insert, attachment/mention rows,
  conversation denormalization update, outbox events, audit row, and
  idempotency finalize commit atomically (core.md §4).

### 5.3 `order_cards` concurrency (phase-1 slice)

No status machine. Core's per-aggregate delivery ordering and the
transaction-scoped `(consumer, aggregate)` advisory lock (core.md §6)
serialize events of one order; the `(order_id)` unique constraint plus
upsert make concurrent first-materialization safe.

## 6. Realtime contract (Socket.IO)

Phase 5 owns the realtime chat experience end-to-end (scope §7). The
transport (Socket.IO server + Redis adapter in `apps/api`, event
consumption in `apps/worker`) is platform plumbing, but its **contract** is
fixed here:

- **Feed**: exclusively domain events via the outbox → consumer
  `chat.realtime-publisher` → `chat.publishRealtimeUpdate`, which loads the
  affected row(s) from chat's own tables inside the handler, composes the
  frame, and publishes to rooms via the Redis adapter (orders spec §7.4:
  "realtime is Socket.IO fed by domain events"). No handler-to-socket
  shortcuts.
- **Rooms**: `conversation:<id>` (open conversation screen) and
  `user:<id>` (list badges, previews, per-user fan-out). Joining
  `conversation:<id>` is authorized by executing `chat.getConversation`
  (staff, with company selector) or `chat.getMyConversation` (customer)
  under the socket's authenticated session; `user:<id>` requires only the
  session. A blocked/archived conversation can still be joined (reads are
  allowed).
- **Server→client frames** mirror §4.1 events. `message.sent` frames carry
  the full hydrated `Message` (content included — realtime is transport, not
  storage); frames for deleted messages carry the masked shape.
- **Delivery semantics**: at-least-once. Clients dedupe by
  `(conversationId, sequence)` for messages and by event ID otherwise;
  per-aggregate delivery ordering (core.md §6) keeps frames in-order per
  conversation.
- **Offline / reconnect**: the client stores its last known `sequence` per
  conversation and `updatedAt` cursor for the list; on reconnect it calls
  `chat.listMessages`/`listMyMessages` with `afterSequence` (gapless
  sequences make holes detectable) and re-syncs the list. Realtime frames
  are an optimization, never the source of truth.
- **Typing indicators**: ephemeral client→server socket events relayed to
  the conversation room after a room-membership check; never persisted,
  never domain events, never actions. This is an explicit, deliberate
  exception to "one data path": no state, no business logic, no audit
  surface. Server-side relay rate limit: 1 frame/sec/conversation/user.
- **Online presence** (v1 `/presence` gateway's user-online part; owner,
  2026-08-17 — in phase 5). Same ephemeral class as typing: Redis-backed,
  not persisted, not domain events, not actions, not audited.
  - A user is **online** while they have ≥1 authenticated Socket.IO
    connection. Heartbeat every 15s; presence key TTL 45s so mobile
    reconnects do not flicker.
  - **Visibility** is conversation-scoped, never a global user directory:
    staff with `chat:view` may observe the `customer_user_id` of
    conversations of *this* company; a customer may observe
    **company-side** presence as a boolean ("someone from the company is
    online") — individual staff identities are not leaked. Observing a
    user who is not a counterparty of an authorized conversation is
    rejected by the socket join/subscribe handler.
  - On joining `conversation:<id>`, the server emits a snapshot
    `{ customerOnline, companyOnline }`. Subsequent `presence.update`
    frames go to that conversation room and to `user:<id>` so the panel
    list can show customer dots for currently visible rows without
    polling.
  - v1 `/presence` also pushed **business events** (new orders, invoice
    statuses, bank sync). Those stay out of chat: they are other modules'
    domain events → notifications / their own realtime, not this gateway.

## 7. Edge cases

1. **Cross-tenant / cross-user probing.** Staff of company A reading
   company B's conversation, customer X resolving customer Y's
   conversation, reactions/edits targeting foreign messages — all
   `NotFoundError` via membership scope or target resolution
   (`crossTenantSuite` for both modes).
2. **Draft invisibility.** Draft conversations never appear in
   `chat.listConversations`/`getConversation` and produce no staff-facing
   notifications; the customer sees their own draft. First customer message
   promotes and only then does the company learn the conversation exists
   (v1 `20260401000006`).
3. **Staff messaging an unlinked CRM customer.**
   `chat.startConversation` for a customer without a linked account →
   `ConflictError` (there is no user to converse with; consistent with
   orders §10.8). **Customer** `chat.openMyConversation` does *not* require
   a CRM link — any authenticated user may message a published company
   (ADR-0018). Chat never creates CRM records; the `company_customer_id` is
   set only when one already exists, `null` otherwise.
4. **CRM record deleted mid-conversation.** `company_customer_id` →
   NULL (SET NULL); the conversation and history survive on
   `customer_user_id`; staff hydration falls back to `customer: null` and
   `customerDisplayName`; customer access is unaffected (v1 policies keyed
   on user ID, same result).
5. **Non-CRM chatter later accepts an invite.** Unique
   `(company_id, customer_user_id)` makes `ensureConversationFromInvite` a
   no-op insert; it attaches `company_customer_id` to the existing row
   (and does not unblock a blocked conversation).
6. **Blocked conversation.** Customer send/edit/react →
   `ConflictError`; the cabinet renders the blocked state (the customer
   necessarily observes it — not an information leak, the block is the
   product behavior). Staff must unblock before sending.
7. **Duplicate send retry.** Same idempotency key → stored replay, no
   second message/sequence/event (`idempotencySuite`); different key with
   identical content is a legitimate new message (chat does not
   content-dedupe).
8. **Attachment misuse.** File not finalized, uploaded by someone else, or
   scoped to another conversation/company → `NotFoundError` from
   validation via `files` facts; > 10 attachments → `ValidationError`.
   Deleting a file row referenced by a message is blocked (`RESTRICT`) —
   files-side lifecycle must archive instead (flag to the files spec, §12).
9. **Reply integrity.** `replyToMessageId` from another conversation →
   `ValidationError`; replying to a deleted message is allowed (renders as
   "deleted message" — v1 behavior).
10. **Deleting/editing the latest message.** The handler recomputes
    `last_message_preview`/`content_type`/`sender_type` from the newest
    non-deleted message (or NULL when none remain) in the same transaction —
    the v1 trigger never did this; the stale-preview bug is not carried.
11. **Unread counter integrity.** Counters are recomputed against cursors
    on `markRead` (§5.2) and never go negative (CHECK); drift between
    counter and cursor-derived count is a test failure, not an accepted
    state.
12. **Editing a deleted message / reacting to a deleted message.**
    `ConflictError`.
13. **Sender-only editing.** Edit/delete by a non-sender (including other
    staff of the same company) → `PermissionDeniedError` for staff mode,
    `NotFoundError`-free explicit denial; v1 RLS allowed sender only —
    carried. No time window (v1 parity).
14. **Redelivered chat events.** `chat.realtime-publisher` redelivery
    re-publishes a frame; clients dedupe (§6). `event_deliveries` dedup
    prevents double DB effects (`eventSuite`).
15. **Order-card projection (phase-1 slice).**
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
16. **User is staff in company A and customer of company B.** Both surfaces
    work independently; `sender_type` is captured per message; the same
    user gets separate participant rows per conversation.
17. **Open conversation with a nonexistent or unpublished company.**
    `resolveTarget` `companies.getPublishedCompany` → `NotFoundError` for
    nonexistent or unpublished companies; no conversation row created.
    Exception: if the user already has a CRM record with the company
    (`company_customers` row exists), the conversation is allowed even when
    the company is unpublished — existing relationships are not severed by
    unpublishing (ADR-0018).
18. **Existing conversation with a company that unpublishes.** The
    conversation and full message history remain accessible to both sides.
    The customer can continue sending messages (the conversation already
    exists; the publication check applies only to *new* conversation
    creation). This matches the CRM-relationship exception: once a
    conversation exists, it is an established relationship.
19. **Chat does not create CRM records.** Opening a conversation, sending
    messages, browsing profiles — none of these create a `company_customers`
    row (ADR-0018). The `company_customer_id` column is set lazily when a CRM
    row already exists, and backfilled when the user later becomes a CRM
    customer (e.g., at checkout or invite accept).
18. **Presence subscribe to a non-counterparty.** Socket subscribe is
    rejected; HTTP actions never return presence (it is socket-only).

## 8. v1 migration notes

Sources: `20260301000015_messaging.sql`, `20260307000001`, `20260309000001`,
`20260310000001`, `20260311000001`, `20260319000001`, `20260401000006`,
`20260407000002`. All user-ID columns are remapped through the auth
migration mapping (db.md §4). All chat RLS policies are dropped; the
replacement is the §3 permission/resolver table.

### 8.1 `conversations` → `conversations` (TRANSFORM)

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id`, `company_id`, `created_at`, `updated_at` | same | Direct copy |
| `customer_user_id` (nullable) | `customer_user_id NOT NULL` | Auth-mapped. Rows with NULL (external-channel conversations) are **not migrated** — they belong to the dropped Meta channels; count reported |
| `channel`, `external_contact_id` | — | DROP (single-channel v2; scope §5) |
| `status` | `status` | Direct copy (`draft`,`active`,`archived`,`blocked` all carried) |
| `assigned_to` | `assigned_to_user_id` | Auth-mapped |
| `customer_name` | `customer_display_name` | Direct copy; `'Customer'` if null/empty |
| — | `company_customer_id` | Backfilled by joining `company_customers` on `(company_id, user_id)`; NULL when no CRM record |
| `last_message_text` / `last_message_at` / `last_message_by` / `last_message_content_type` | `last_message_preview` / `last_message_at` / `last_message_sender_type` / `last_message_content_type` | Direct copy; `company_member` → `staff`; `order`/`product` content types pass through |
| `company_unread_count`, `customer_unread_count` | same | Direct copy |
| — | `last_sequence` | `count(messages)` per conversation (equals max renumbered sequence, §8.2) |

**Cleanup:** conversations of the dropped Meta channels and
`messaging_contacts` (DROP with Meta, already in the matrix).
**Reconciliation:** row count (web-channel only) equality; per-conversation
`last_sequence = count(messages)`; unread counters copied verbatim and
cross-checked against cursor-derived counts — drift reported, not silently
fixed.

### 8.2 `messages` → `messages` (TRANSFORM)

| v1 column | v2 column | Transform |
| --- | --- | --- |
| `id`, `conversation_id`, `company_id`, `content`, `content_type`, `created_at`, `edited_at`, `deleted_at` | same | Direct copy (`order`/`product` content types pass through; their rendering is phase 6 / mention-based) |
| `sender_user_id` (nullable) | `sender_user_id NOT NULL` | Auth-mapped; NULL senders exist only on dropped external-channel rows |
| `sender_type` | `sender_type` | `company_member` → `staff`; `external_contact` rows are dropped with their conversations |
| `sender_name` | — | DROP — hydrated at read time |
| `sequence_number` (global) | `sequence` (per-conversation) | `row_number() OVER (PARTITION BY conversation_id ORDER BY sequence_number)` — order preserved exactly, gapless per conversation |
| `metadata.reply_to` | `reply_to_message_id` | Extracted from jsonb; unresolvable IDs → NULL (reported) |
| `metadata.attachments` | `message_attachments` rows | One row per attachment after the files-module migration assigns v2 file IDs to migrated `chat-attachments` objects (cutover ordering §8.7) |
| `metadata` (rest), `channel_metadata`, `external_message_id` | — | DROP (Meta-only) |
| `status` (sending/sent/delivered/read/failed) | — | DROP — delivery state is client-local; read state lives in participant cursors. v1 rows are overwhelmingly `sent`; nothing to preserve |
| `updated_at` | `updated_at` | Direct copy |

**Reconciliation:** per-conversation row counts match; max `sequence` =
count; `(conversation_id, created_at)` ordering equals renumbered
`sequence` ordering; soft-deleted counts match.

### 8.3 `conversation_participants` → `conversation_participants` (TRANSFORM)

Direct copy of `conversation_id`, `user_id` (auth-mapped),
`notifications_enabled`, timestamps; `role` `company_member` → `staff`,
`participant` (unused generic) → `staff`; `company_id` denormalized from the
conversation; `last_seen_message_id` → `last_seen_sequence` via the
message's renumbered sequence (NULL → 0); `last_seen_at` direct copy.
Participants of dropped conversations are dropped with them.

### 8.4 `message_reactions` → `message_reactions` (TRANSFORM)

Direct copy (the one-per-user unique already holds in v1 after
`20260319000001`); `company_id` denormalized from the message; `user_id`
auth-mapped.

### 8.5 `message_mentions` → `message_mentions` (TRANSFORM — resolves the matrix REVIEW row)

Copy `message_id`, `entity_type`, `entity_id`, `start_index`, `end_index`,
`company_id` (already denormalized in v1), `created_at`. **`entity_snapshot`
is dropped** — storing entity name/price/status in chat violates ADR-0011;
v2 renders mentions by fetching current state and shows "unavailable" for
deleted entities. No historical-price value is lost: money truth lives in
order snapshots, never in chat.

### 8.6 Functions, triggers, RPCs, storage

| v1 object | Decision | v2 location |
| --- | --- | --- |
| `update_conversation_on_message` trigger | MOVE | Send-handler denormalization update (§5.2), including the preview-recompute fix (§7.10) |
| `create_conversation_participants` trigger | MOVE | Conversation-create handlers insert the customer participant row |
| `update_conversation_assignment` trigger | MOVE | `chat.assignConversation` handler upserts the assignee participant row |
| `increment_unread_count` RPC | MOVE | Counter math in the send/markRead handlers |
| `toggle_message_reaction` RPC | TRANSFORM | `chat.setReaction` — toggle semantics replaced by set/clear so retries are idempotent |
| `find_order_conversation` RPC | TRANSFORM (phase 6) | Order-collaboration rework (redirect-to-chat) |
| `get_conversation_recap` RPC | DROP (decomposed) | Cross-domain aggregation dissolves: order stats via `orders` reads (phase 4), participant info via §3 outputs; a chat media-count read can be added later if the UX needs it |
| `conversation_message_seq` sequence | DROP | Per-conversation `last_sequence` (§5.2) |
| `conversations_update_timestamp` etc. | KEEP | Shared `updated_at` trigger (db.md §5) |
| `chat-attachments` storage bucket + RLS | TRANSFORM | Same S3 key structure under MinIO/R2, owned by `files`; access via signed URLs authorized through `files` actions calling chat's conversation reads (§12) |
| All chat RLS policies | DROP | §3 permissions (`chat:view`/`chat:respond`) and typed customer resolvers |
| `messaging_contacts`, `meta_data_deletion_requests` | DROP | With Meta (already in the matrix) |

### 8.7 Cutover and rollback

1. Order: auth users → companies/customers → **files** (chat-attachments
   objects get v2 file rows) → conversations → messages →
   participants/reactions/mentions → attachment link rows → reconciliation.
2. Chat migration runs in the launch window with v1 writes stopped
   (messages are append-heavy; no dual-write).
3. Rollback: restore from pre-migration backup (db.md §6, forward-only);
   v1 (`E:\showzy`) is never modified.

### 8.8 `order_cards` (v2-new; no v1 source)

Born of ADR-0011. No launch data migration — cards for pre-migration orders
are not backfilled in phase 1 (phase 6 decides backfill when cards attach
to real conversations). This table authorizes no work on v1 chat tables;
those are §8.1–8.7.

## 9. Non-functional requirements

- **PII containment**: message content lives only in `messages.content`,
  `conversations.last_message_preview`, `conversations.customer_display_name`,
  and transient realtime/push frames. It never enters domain-event payloads,
  audit rows (hash-only, no `auditSnapshot` on any chat action), or logs.
  `chat.getMessageContext` previews are transient and must not be persisted
  by consumers. Presence keys store only user IDs and TTLs, never names.
- **Volume**: chat is the module's hot path. Every message produces one
  outbox event + deliveries + one audit row — acceptable at launch scale
  (micro-business, 1:1 chats); if audit volume from `markRead` proves
  noisy, reducing it requires a core-rule change (`risk: write` mandates
  audit), not a module hack. Clients debounce `markRead`.
- **Latency**: send → realtime frame p95 within ~1s (outbox poller is
  LISTEN/NOTIFY-woken, core.md §6). Presence snapshot on room join < 100ms
  (Redis). Reads are cursor-paged, max 100 messages/page, no offset
  pagination.
- **Rate limits**: core defaults (120/min per user) suffice for actions;
  typing relay 1/sec/conversation/user; presence heartbeat 15s.
- **Content limits**: 8000 chars/message; 10 attachments; 20 mentions.
  Attachment size/type policy belongs to `files`.

## 10. Acceptance criteria

Mandatory minimum:

- [ ] Cross-tenant isolation for staff and customer modes on every action
      (inherited `crossTenantSuite`); customer target resolution returns
      `NotFoundError` for foreign conversations/messages with no existence
      leak.
- [ ] Authorization denial: missing `chat:view`/`chat:respond` →
      `PermissionDeniedError` (audited on audited actions); non-sender
      edit/delete denied.
- [ ] Validation failures are typed `ValidationError` (empty message with
      no attachments/mentions, oversize content, >10 attachments, foreign
      `replyToMessageId`, client-supplied `system` content type, missing
      idempotency key on writes).
- [ ] Outputs validate at runtime and are JSON-safe.
- [ ] Idempotency (`idempotencySuite`) on all writes: send replay produces
      no second message/sequence/event; get-or-create replay returns the
      same conversation.
- [ ] Declared events emit transactionally (`eventSuite`); a failed send
      leaves no message, attachment/mention rows, events, or audit rows.
- [ ] Audit rows for every `risk: write` action with the declared targets.

Module-specific:

- [ ] **Gapless ordering**: N concurrent sends to one conversation yield
      sequences 1..N with no gaps/duplicates; `last_sequence` equals the
      message count.
- [ ] **Draft lifecycle**: draft is invisible to all staff reads and
      events-driven staff notifications; first customer message promotes
      it to `active` atomically with the message insert.
- [ ] **Unread/read-receipt correctness**: counters match cursor-derived
      counts after arbitrary interleavings of send/markRead from both
      sides; cursors never move backwards.
- [ ] **Blocked behavior**: per §5.1 matrix, both principals.
- [ ] **Soft delete**: deleted messages return masked content and empty
      attachments through every read; preview recomputes when the latest
      message is deleted/edited.
- [ ] **Reaction set/clear**: replay-safe; one reaction per user per
      message enforced under concurrent set calls.
- [ ] **Attachment scope**: a finalized file from another conversation or
      uploader is rejected; the happy path links files by ID only (schema
      check: no file metadata columns in chat tables).
- [ ] **ADR-0011 schema check**: no chat table carries order/product/
      customer *domain-state* columns (status, totals, prices);
      `customer_display_name` is a create-time UX snapshot, not live CRM
      state; `message_mentions` has no snapshot column; `order_cards`
      contains no order status/amount/state column (adding one fails review).
- [ ] **Order-card slice (phase 1):** consuming `orders.created` materializes
      exactly one card per order (unique on `order_id`), inside the delivery
      transaction, with an audit row; `orders.confirmed` bumps `revision`;
      redelivery of either event is a no-op (no second card, no revision
      bump, no second audit row); confirmed-before-created replay still
      converges to one card; rollback of the delivery transaction leaves no
      card and no `processed` delivery row; `chat.getOrderCard` cross-tenant
      → `NotFoundError`, missing `chat:view` → `PermissionDeniedError`,
      output validates at runtime; `chat.upsertOrderCard` is unreachable via
      client transport, OpenAPI, and AI manifests; a dead delivery for
      `chat.order-card-updater` does not block the payments consumer of the
      same event.
- [ ] **Realtime contract**: publisher redelivery produces a duplicate
      frame with identical dedup keys (client contract test); frames for
      one conversation arrive in sequence order; reconnect delta fetch via
      `afterSequence` returns exactly the missed messages.
- [ ] **Event payload hygiene**: property-based/contract test that no §4.1
      payload contains message content.
- [ ] **Any-auth open**: `chat.openMyConversation` for a published company
      with no CRM link creates a `draft`; unknown or unpublished company →
      `NotFoundError`; CRM-linked user can open conversation even with
      unpublished company; staff list still hides drafts.
- [ ] **No CRM creation from chat** (ADR-0018): `chat.openMyConversation`
      never creates a `company_customers` row; `company_customer_id` is
      `null` when no CRM record exists at conversation creation time; a
      subsequent CRM record creation (checkout/invite) can backfill it.
- [ ] **Publication rule for new conversations** (ADR-0018):
      `chat.openMyConversation` with a new (no existing conversation)
      unpublished company → `NotFoundError`; existing conversations with
      unpublished companies remain fully accessible (read, send, react,
      edit, delete, markRead).
- [ ] **Invite auto-create**: consuming `invites.accepted` creates exactly
      one `active` conversation; a second delivery is a no-op; an existing
      draft is promoted only by the customer's first message, not by the
      invite (invite creates `active` when inserting; when a row exists it
      only attaches the CRM id).
- [ ] **No unified inbox**: there is no `chat.listMyConversations` action
      in the registry.
- [ ] **Presence**: counterparties receive snapshots on join; a staff
      socket cannot subscribe to a user who is not a customer of this
      company's conversations; customer frames never include staff user
      IDs; presence state is absent from all tables and event payloads.
- [ ] **Join-row ownership**: `message_attachments` lives in
      `schema/chat.ts` and stores `file_id` only.

## 11. Resolved decisions and remaining items

Resolved (owner, 2026-08-17):

1. **No unified customer inbox in V2.** Cabinet chat is entered per
   company. `chat.listMyConversations` is not in this spec. A customer
   self-scope read in core is *not* requested here; phase-4
   `orders.listMine` may still need it independently.
2. **Any authenticated user may message any published company** (v1
   behavior, refined by ADR-0018 publication rule). A CRM link is not
   required to open a conversation. `company_customer_id` is set only when
   a CRM row already exists at conversation creation time (`null`
   otherwise); it is backfilled when the user later becomes a CRM customer
   (e.g., at checkout or invite accept). **Chat never creates CRM
   records** — discovery, browsing, opening conversations, and sending
   messages produce no `company_customers` side effects (ADR-0018 §CRM
   customer creation). A user with an existing CRM record may open a
   conversation even with an unpublished company (existing relationships
   are not blocked by unpublishing).
3. **Auto-create the conversation on invite accept** — keep v1 behavior.
   Consumer `chat.invite-conversation-creator` →
   `chat.ensureConversationFromInvite`. Requires the future invites spec
   to emit `invites.accepted`.
4. **Keep `draft` status** (v1 behavior).
5. **Online presence is in phase 5** (user-online dots; not v1's business-
   event presence dump). Contract in §6.
6. **Edit/delete**: sender-only, no time window, soft delete with content
   retained in the DB and masked on output (v1 parity).
7. **`message_attachments`**: chat owns the message↔file join rows
   (file IDs only); `files` owns file records, bytes, upload/download
   authorization. Refines `docs/module-ownership.md` without moving file
   ownership.
8. **`resolveTarget` receives read-only `call`.** Core change request
   accepted: customer/public `resolveTarget` is given a depth-limited
   read-only `call` with the same rules as handler `ctx.call` (ADR-0015),
   so `openMyConversation` can prove company existence and publication via
   `companies.getPublishedCompany` without chat querying `companies` tables
   (ADR-0018 publication rule). Lands as a core `/rework-spec` (+ ADR if
   core's authors require one) before phase-5 implementation; chat does not
   work around it.
9. **core.md §10 AI per-conversation budget** belongs to the `assistant`
   module (phase 8), not this chat. This spec defines no AI token budget.
10. **One chat spec.** The phase-1 order-card slice lives in this file
    (`order_cards`, `chat.upsertOrderCard`, `chat.getOrderCard`,
    `chat.order-card-updater`), not a companion `chat-projection.md`.
    `companies-foundation.md` remains separate only because the full
    companies spec does not exist yet.

Composition owed by other specs (not product questions):

- **`companies.getPublishedCompany`** — customer-compatible `risk: read`;
  verifies the company exists and is published (ADR-0018 publication rule;
  decision 2). Used by `openMyConversation` `resolveTarget` for new
  conversations. Exact name/output: companies spec.
- **`invites.accepted` payload** must include `companyId`,
  `customerUserId`, `companyCustomerId`, and a display name. Exact shape:
  invites spec.

## 12. Composition contract (required callee capabilities)

Per ADR-0015 (`ctx.call` targets must be `risk: read` and
principal-compatible). Gaps block implementation and must be reported, not
worked around.

| Callee | Action (expected) | Principal compat | What chat needs |
| --- | --- | --- | --- |
| `customers` | `customers.getCustomerOrderFacts` (exists, orders §11) or a batch chat variant | staff | `customerId → { displayName, userId }` for list/get hydration and `startConversation` verification; batch form preferred to avoid N+1 in `listConversations` |
| `customers` | a customer-principal "am I a CRM customer of this company?" read, optional | customer | Best-effort attach of `company_customer_id` in `openMyConversation`; absence → null, not an error |
| `companies` | `companies.getMemberFacts` (future companies spec) | staff, system | Assignee verification in `assignConversation`; member recipient list in `chat.getMessageContext` |
| `companies` | `companies.getPublishedCompany` (future companies spec) | customer | Existence + publication proof inside `openMyConversation` `resolveTarget` (§11 decision 8; ADR-0018 publication rule). Returns `NotFoundError` for nonexistent or unpublished companies. When the user has an existing CRM record, the publication check is bypassed by chat's own `resolveTarget` logic (§3.2) |
| `companies` | customer-compatible company facts read (name, slug, logo) | customer | Cabinet hydration in `MyConversation` (may be the same action as `getPublishedCompany` if the companies spec so decides) |
| `files` | `files.getAttachmentFacts` (future files spec) | staff, customer | Batch `fileId → { finalized, uploaderUserId, scope: { companyId, conversationId }, mime, size }` for send validation |
| `files` (reverse direction) | — | — | `files` download/upload authorization for chat attachments is expected to `ctx.call` `chat.getConversation` (staff) / `chat.getMyConversation` (customer) as the access proof; both are declared client reads here and also serve that role |
| `invites` | `invites.accepted` event | — | Bound to `chat.ensureConversationFromInvite` (§4.2) |
| `notifications` (consumer side) | — | — | Consumes `chat.messageSent` etc. and calls `chat.getMessageContext` (system read, §3.3) at delivery time |

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | ADR-0018 rework (spec-rework-queue Step 5): `openMyConversation` publication rule (new conversations require published company, unless CRM record exists); explicit no-CRM-creation guarantee; `company_customer_id` lazy-set and backfill semantics; renamed `companies.getVisibleToUser` → `companies.getPublishedCompany`; new edge cases §7.18–7.19; new acceptance criteria for publication and CRM invariants. | ADR-0018 consumer discovery alignment | spec-rework agent |
| 2026-08-17 | Approved. Slice absorbed from `chat-projection.md`; owner decisions 1–10 in §11. | Owner approval | owner |
| 2026-08-17 | Absorbed the approved `chat-projection.md` slice into this file (table, actions, consumer, edge cases, acceptance). Slice behavior unchanged; companion file removed. | One spec per module (`orders.md` pattern); owner request | owner |
| 2026-08-17 | Owner decisions folded in: per-company cabinet (no unified inbox), any-auth messaging, invite auto-create, draft kept, presence in phase 5, v1 edit/delete, chat owns attachment join rows, `resolveTarget.call` core change accepted, AI budget is assistant's. | Draft review Q&A | owner |
| 2026-08-17 | Initial draft. Resolves the `message_mentions` REVIEW row | Phase-5 chat platform specification | spec agent |
