# Spec: payments foundation

> Status: Living. Last approved draft: owner, 2026-08-17.
> Written against blueprint §2.1/§5, scope §4/§6, ADR-0008, ADR-0012,
> ADR-0013, ADR-0015, and `docs/specs/core.md`.
> This spec defines the phase-0 payment boundary. Mono acquiring remains
> post-MVP and must plug into this boundary without changing core or orders.

## 1. Purpose and ownership

`payments` is the source of truth for payment records and payment status.
Orders/documents store links and immutable commercial snapshots, not a second
authoritative payment state. The MVP provider is `manual_invoice`; future
`acquiring` owns Mono-specific onboarding/webhooks/fiscalization and reports
normalized provider facts to `payments` through actions/events.

## 2. Owned tables

`payments`: `id`, `company_id`, `order_id`, `customer_user_id`,
`provider` (`manual_invoice|mono`), `status`, `amount_minor bigint`,
`currency char(3)`, `refunded_minor bigint default 0`, `provider_reference`,
`failure_code`, `version`, timestamps. Unique provider reference when
present; indexes `(company_id, order_id)`, `(customer_user_id, created_at)`,
`(provider, provider_reference)`.

`payment_documents`: `payment_id`, `document_id`, `kind` (`invoice|receipt`),
timestamps; unique `(payment_id, document_id)`. Cross-module FKs are
`RESTRICT`. Amounts are immutable snapshots; wire values are decimal strings.

## 3. State machine

`pending → awaiting_invoice → invoice_issued → paid`

Additional terminal/exception paths:

- `pending|awaiting_invoice|invoice_issued → canceled`;
- `pending|invoice_issued → processing → paid|failed` (future acquiring);
- `paid → partially_refunded → refunded` (future acquiring);
- provider reports are monotonic and deduplicated; stale/out-of-order reports
  are recorded for audit but cannot move state backward;
- `refunded_minor` may increase only, never exceed `amount_minor`.

UAH-only MVP. Payment amount must equal the immutable order payable snapshot;
any later order amendment creates/adjusts payment through an explicit action,
never by silently mutating amount.

## 4. Actions

All inputs use IDs as selectors; tenant/ownership comes from context.

Shared output `Payment`: IDs, provider/status, `amountMinor` and
`refundedMinor` as canonical decimal strings, currency, document IDs, and
timestamps; never provider secrets or expiring URLs.

| Action | Contract |
| --- | --- |
| `payments.createForOrder` | system/tenant, transport internal, AI internal, write, confirmed: no, idempotent + audit, 5s. Input `{ orderId, customerUserId, amountMinor, currency: "UAH" }`; output `Payment`; permission `[]`; emits `payments.created`. Key = source `orders.created` event ID |
| `payments.attachInvoice` | system/tenant, transport internal, AI internal, write, confirmed: no, idempotent + audit, 5s. Input `{ paymentId, documentId }`; output `Payment`; permission `[]`; emits `payments.invoiceAttached`. Key = source document event ID |
| `payments.recordProviderStatus` | system/tenant, transport internal, AI internal, write, confirmed: no, idempotent + audit, 5s. Input `{ paymentId, provider, providerReference, status, occurredAt, refundedMinor? }`; output `Payment`; permission `[]`; emits `payments.statusChanged`. Key = verified provider delivery ID |
| `payments.cancel` | staff, transport client, AI exposed, high, confirmation + redacted summary, idempotent + audit, 5s. Input `{ paymentId, reason }`; output `Payment`; permission `payments:cancel`; emits `payments.canceled` |
| `payments.get` | staff, transport client, AI exposed, read, no confirmation/idempotency/audit, 2s. Input `{ paymentId }`; output `Payment`; permission `payments:read`; emits none |
| `payments.getOwn` | customer, transport client, AI exposed, read, no confirmation/idempotency/audit, 2s. Input `{ paymentId }`; output `Payment`; permission `[]`; emits none. Typed resolver verifies `customer_user_id = principal.userId`, returning not-found on mismatch |

For every audited action, `auditTarget` returns the resulting payment ID/type;
no raw provider payload is snapshotted. `payments.cancel`'s confirmation
summary shows payment reference, amount/currency, and redacted reason.

No action executes arbitrary provider code inside the database transaction.
External provider calls use a worker job keyed by `paymentId`; normalized
results return through `payments.recordProviderStatus`.

## 5. Events and integration boundary

Emitted (version 1): `payments.created`, `payments.invoiceAttached`,
`payments.statusChanged`, `payments.canceled`. Payloads carry IDs, normalized
status, immutable amount/currency where needed, and use the core envelope.

- `orders.created` is consumed to create one payment via source-event
  idempotency; orders may consume payment events for explicit order
  transitions but payment status remains owned here.
- `documents.invoiceGenerated` is consumed to attach an invoice.
- Future `acquiring` consumes a payment-request event or worker command and
  reports normalized status; raw webhook payload/signature/delivery state
  remains acquiring-owned.
- Chat/notifications consume payment events as projections and store IDs, not
  authoritative payment status.

## 6. Security, audit, and failure behavior

- Provider credentials come only from validated environment/secret storage.
- Webhook/provider authenticity is verified before a system context exists.
- Provider references and failure codes may be audited; raw payloads,
  credentials, card data, and invoice contents may not.
- A timeout after an external call is reconciled by provider reference before
  retry; retries reuse `paymentId` as provider idempotency key.
- Every status-changing action is audited with accountable system/user actor
  and invocation channel.

## 7. Acceptance criteria

- [ ] Duplicate `orders.created` delivery produces exactly one payment.
- [ ] Same idempotency key with a different amount/order conflicts.
- [ ] Staff/customer/system cross-tenant cases fail without leaking existence.
- [ ] Customer can read only a payment whose `customer_user_id` matches.
- [ ] Out-of-order provider reports cannot regress status.
- [ ] Refund total cannot exceed the immutable payment amount.
- [ ] Payment write + event + audit commit atomically.
- [ ] Provider timeout/retry does not create a second provider payment.
- [ ] No provider secret/raw card data appears in logs, events, or audit.
- [ ] Future Mono adapter can integrate through the defined normalized
      boundary without changing `packages/core` or `orders` table ownership.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial foundation draft | Close payment ownership/protocol gap before scaffold | GPT-5.6 Sol |
