# Order — Classic UI Journey

> Status: Approval #2 granted by the owner on 2026-08-17  
> Linear: SHO-10 · Quadrants: Staff/Classic, Customer/Classic  
> Evidence: approved constraints and internal assumptions only

## Context and preconditions

Customers enter from discovery, invite, direct link, cart, notification, or a
chat card. Staff enter from the active-company order queue, notification,
customer, or conversation. Role and company remain visible.

- Order creation requires an authenticated Showzy account.
- Cart and target intent survive install/sign-in.
- Company, products, variants, price, and permissions are rechecked online.
- Staff creation requires `orders:create` and an existing company customer
  linked to a Showzy account.

## Customer path

1. Open a published company and add active product variants to its canonical
   cart; this creates no CRM row.
2. Review company, items, quantities, current displayed price, and checkout.
3. Sign in if required; restore the same cart and revalidate every line.
4. Provide contract-defined contact/delivery data and invoice-based payment
   choice. Online acquiring is not offered.
5. Review items, delivery, total, and the checkout-to-chat consequence.
6. Submit once through idempotent checkout.
7. The order atomically links/creates the CRM customer and stores immutable
   item, price, discount, tax, total, and counterparty snapshots.
8. Open the company conversation focused on the existing order card.
9. Follow current order state and valid actions through `orders`.

## Staff path

1. Open a new order from Home, Orders, Chat, or notification.
2. Review current snapshots and ask for clarification in the conversation.
3. Perform only lifecycle actions valid for role and state.
4. Confirmation/edit/cancellation executes in `orders`; events refresh chat,
   notifications, and queues.
5. For manual creation, select a linked customer and products, review resolved
   price, submit once, then use the same collaboration path.

## Classic ↔ AI handoffs

- Ask AI with company plus cart/order ID and return route, never copied state.
- AI may summarize or prepare; authentication, dense comparison, delivery,
  editing, and high-risk confirmation return to classic UI.
- Preserve context and mutation-attempt identity when outcome is unknown.
- Refresh authoritative state after every handoff; never create another cart
  or order.

## Ownership and recovery

- `orders` owns carts, orders, lifecycle, logs, and immutable snapshots.
- `pricing` resolves current prices; `catalog` owns product availability.
- Chat stores the order ID/projection metadata, never status or totals.
- Loading disables repeat submit. If chat projection lags after success, show
  the order result and retry navigation only.
- Validation marks changed/unavailable lines and preserves valid input.
- Offline may show dated cached state/local cart intent; checkout and lifecycle
  writes are blocked.
- Unknown submit outcome first reads current state, then safely retries with
  the same idempotency identity.
- Foreign resources disclose no existence; missing permission disables writes.

## Accessibility and internal evaluation

Announce company, status, total, items, current operation, and primary action
in that order. Use exact verbs and non-color state. Confirmations name actor,
company, order, effect, and reversibility.

Internally test both roles, install/sign-in restoration, price change,
checkout-to-chat, delayed projection, offline, permission denial, and
unknown-outcome retry. Verify one order/card only and label findings
`internal evaluation only`.
