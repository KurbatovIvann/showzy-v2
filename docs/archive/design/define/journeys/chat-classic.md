# Chat — Classic UI Journey

> Status: Approval #2 granted by the owner on 2026-08-17  
> Linear: SHO-11 · Quadrants: Staff/Classic, Customer/Classic  
> Evidence: approved chat/order specs and internal assumptions only

## Context and preconditions

Staff enter from the active-company queue, order, customer, or notification.
Customers enter from checkout, one company workspace, profile, order/card, or
notification. V2 has no unified cross-company customer inbox.

- User is authenticated; company/conversation is independently authorized.
- Staff has chat permission; customer owns the conversation.
- A customer-opened conversation stays a staff-invisible draft until its first
  message.
- Order cards retain `orderId` only and read current `orders` state.

## Shared path

1. Open the exact company conversation through a guarded route.
2. Show company, counterpart, connection state, paginated history, unread
   boundary, and contextual cards.
3. Join the authorized realtime room; presence/typing remain ephemeral hints.
4. Compose a message or clarify order details.
5. Show local Sending with one logical idempotency identity.
6. On acceptance, assign the gapless conversation sequence and publish the
   normal realtime/notification event.
7. Recipient opens current in-app state rather than trusting push text.
8. Monotonic read cursor updates unread/read state.
9. Order actions execute in `orders`; domain events refresh the existing card.
10. On reconnect, fetch after the last sequence, detect gaps, deduplicate, and
    rehydrate cards.

## Classic ↔ AI handoffs

- Staff/Customer may ask AI to find, summarize, explain, or draft within the
  same company and conversation.
- AI returns to classic chat for human conversation, history/attachment review,
  and confirmations.
- Carry stable IDs and scope, never merge AI history with business chat.
- AI-generated text is not sent until the typed chat action succeeds.

## Ownership and recovery

- `chat` owns conversations, messages, attachments by file ID, reactions, read
  cursors, and chat-local previews.
- Orders, documents, files, delivery, payments, and notifications retain their
  own state; cards reference IDs.
- Loading separates history failure from card hydration and preserves composer.
- Empty draft explains that staff sees it after first send; staff lists exclude
  drafts.
- Offline may show dated cached history and queue only safely replayable
  messages; presence/read state pauses.
- Retry the same logical message with the same identity. Repeated frames
  deduplicate by sequence/event.
- Cross-tenant/foreign conversation behaves as not found. Missing permission
  is explicit; blocked conversation disables sending.
- Do not invent durable Delivered state; accepted/read are authoritative.

## Accessibility and internal evaluation

Announce new messages without moving focus. Provide a new-messages boundary,
jump-to-latest, sender/attachment labels, non-color send/read/sync states, large
text, reduced motion, and 44×44 targets.

Internally test checkout/notification entry, draft promotion, send failure and
same-key retry, reconnect gaps, card refresh, blocked/denied state, AI handoff,
screen reader, and one resulting message. Label findings
`internal evaluation only`.
