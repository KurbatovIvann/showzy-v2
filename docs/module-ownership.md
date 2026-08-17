# Module ownership and composition map

> Status: Approved by owner, 2026-08-17.
> Normative companion to blueprint §5, scope §6, ADR-0011, ADR-0014, and
> ADR-0015. Module specs refine this map but may not move ownership silently.

## Rules

- Every table has one owner in `packages/db/src/schema/<module>.ts`.
- Only the owning module queries its tables. Synchronous cross-module reads
  use principal-compatible `risk: read` actions through `ctx.call`.
- Cross-module effects use domain events. `search` and `analytics` may receive
  explicit read-model grants in the owning spec; no other direct reads.
- Auth and foundation tables are platform-owned, not domain-owned.

## Foundation ownership

| Owner | Tables/capabilities | Boundary |
| --- | --- | --- |
| `packages/db` / better-auth | users, sessions, accounts, verification/OTP tables | Identity only; company authorization belongs to `companies` |
| `packages/core` protocol (physical schema in `db/foundation.ts`) | domain events/deliveries, idempotency keys, audit log | No domain state; module tasks may not change these tables |

## MVP domain ownership

| Module | Owns | Main composition |
| --- | --- | --- |
| `companies` | companies, memberships, RBAC roles/overrides, legal requisites, public profile/showcase settings | Emits company/member/profile events; exposes principal-compatible company/profile reads |
| `customers` | company CRM customer records, customer groups/membership, customer legal profiles | Calls `companies` reads where needed; exposes pricing/order customer facts |
| `catalog` | products, variants, categories, product media links | Calls `files` for attachment capabilities; exposes order/pricing product facts |
| `pricing` | price lists and entries, personal and group price rules | Calls `catalog` and `customers` reads; exposes resolved immutable price facts to `orders` |
| `orders` | carts/items, orders/items, order log, fixed `company_statuses` | Calls catalog/customer/pricing reads; emits order lifecycle events; consumes payment/delivery status events |
| `payments` | payment records, order/document links, provider references, payment status machine | Consumes order/document events; emits payment lifecycle events; future `acquiring` integrates through events |
| `chat` | conversations, participants, messages/reactions, order-card link (`orderId` only) | Consumes order/document events; never owns or copies authoritative order/payment/document status |
| `documents` | documents/items, immutable totals/requisite snapshots, numbering sequences | Calls order/customer/company reads; emits document lifecycle events |
| `doc-generation` | generation jobs and generated-artifact links | Consumes document generation requests; uses `files` for artifacts |
| `doc-signing` | signing requests, signatures, ASiC-E artifacts, verification results | Consumes document events; QES keys never leave the client |
| `delivery` | shipment records and Nova Poshta dictionaries/sync state | Consumes order requests; emits shipment/tracking status |
| `reference-data` | global KVED/CPV classifiers and import metadata | Read-only actions for companies/customers/documents |
| `notifications` | notification intents/deliveries/preferences/device registrations | Consumes domain events; channels are projections, not source state |
| `invites` | invite tokens, redemption/expiry state | Calls companies/customer reads; emits invite lifecycle events |
| `files` | attachment metadata, ownership links, upload/finalization state | Object bytes live in S3/MinIO; exposes signed-upload/finalize actions |
| `feature-flags` | flag definitions and company overrides | Exposes reads; future subscriptions update it through events |
| `search` | FTS projections only | Consumes events or declared read-model grants |
| `analytics` | simple dashboard projections/queries only | Consumes events or declared read-model grants |
| `assistant` | AI conversation/tool-run persistence | Stores action/tool IDs and results; never duplicates domain state |

## Post-MVP ownership

- `acquiring` owns provider onboarding, Mono webhook deliveries,
  fiscalization, and provider-specific records; it never becomes the payment
  source of truth.
- `banking` owns bank connections, statements, transactions, matching, and
  accounting ledger foundations.
- `subscriptions` owns plans/billing/subscription state and updates
  `feature-flags` through events.

## Spec gate

Every module spec must list exact tables, actions, emitted/consumed events,
`ctx.call` targets, and read-model grants. A conflict with this map requires a
human-approved ADR before either spec is approved.
