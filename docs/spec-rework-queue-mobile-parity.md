# Spec-rework queue — V1 mobile parity

> Status: sanctioned by owner, 2026-08-17.
> Triggers: ADR-0019 and ADR-0020.
> Inputs: `docs/design/inventory/` and `docs/design/mapping/`.

This queue changes contracts, not implementation. Every numbered step is a
separate owner-initiated `/rework-spec` or `/spec` review. Frozen specs are
never edited by an implementer.

## Gate 0: constitutional synchronization

Before spec work, owner-controlled updates must reconcile:

- `docs/blueprint.md`: V1 mobile parity, public discovery, aggregate-owned
  social behavior, contextual AI overlay, clean V2 database;
- `docs/scope.md`: restore follows/likes/comments/Following/public browse;
  keep Meta, embeddings, GPS radius, reviews, and data migration dropped;
- `docs/module-ownership.md`: follows in companies; likes/comments in catalog;
  public counters projected into search;
- roadmap/readiness language: full agreed mobile parity before launch.

Acceptance: no constitutional document contradicts ADR-0019/0020.

## Decision D1: stock ownership and atomic confirmation

**Status: accepted — ADR-0021.**

Owner requirement: pending orders do not reserve stock; checkout blocks an
obviously excessive quantity; staff confirmation atomically revalidates and
decrements stock.

Catalog owns fixed-scale product/variant stock. `orders.confirm` uses the
narrow same-transaction `ctx.callAtomic` channel; stable catalog row locking
and non-negative updates ensure one winner in a stock race. Checkout remains a
read-only availability check and does not reserve. Core must implement the
ADR-0021 protocol before stock-dependent catalog/orders implementation.

## Step 1: core, contract, security, DB template

**Rework:** `core`, `contract`, `db`, `security-operations`, spec template.

Required changes:

- define ADR-0020 global public-projection reads separately from single-target
  public actions;
- require a declared published read-model grant and no target resolver for
  that narrow form;
- contract-check `risk: read`, no permissions/audit/events, public rate limit,
  client transport, and projection-only access;
- retain authenticated read-only `consumer`; do not permit consumer writes;
- add public discovery fixtures: unpublished denial, field allowlist, no CRM
  side effects, rate limiting;
- add account/customer fixtures needed for private cross-company collections
  and company-scoped social mutations;
- update the spec template with public-global, social idempotency, optimistic
  reconciliation, abuse, and counter-concurrency cases.

Acceptance: foundation exposes an approved pattern; module tasks do not change
`packages/core`.

## Step 2: companies

**Rework:** full `companies` spec and companies-foundation propagation.

Required capabilities:

- account actions for create/list/restore owned companies;
- one verified active staff company at a time;
- create/edit/publish/unpublish/archive lifecycle;
- public and consumer published profile reads, city/area/categories, external
  social links, working hours, and profile fields required by V1;
- company follows owned by companies;
- customer `setFollow({ followed })`, account `listMyFollows`;
- public follower count, private own-user collection, no follower identity
  listing;
- idempotent followed/unfollowed events; no invite auto-follow;
- staff RBAC and comment-related facts exposed only through typed reads.

Tests: desired-state retries, concurrent counter consistency, unpublished
target denial, own-collection isolation, cross-tenant denial, no CRM creation.

## Step 3: catalog and files

**Rework:** `catalog`; create/approve `files`.

Required capabilities:

- V1 product/category/variant CRUD and all operational fields;
- media upload/finalize/ownership with resumable/background client semantics;
- publication/active lifecycle and public/consumer/customer reads;
- product likes owned by catalog: customer desired-state write, account own
  collection, public count, no liker identities;
- product comments/replies owned by catalog: public read, authenticated
  create/reply, author edit/delete, company reply label, permissioned staff
  deletion;
- product liked/unliked and comment lifecycle events for search/notifications;
- stock schema/actions follow ADR-0021 (`quantity_milli` scale, no launch
  backorders, variant-only decrement when a variant is selected).

Tests: file ownership, published visibility, idempotent likes, comment
authorization/moderation, counter concurrency, cross-company isolation.

## Step 4: search and pricing

**Rework:** `search`, `pricing`.

Search:

- public and consumer FTS+trigram discovery/suggestions;
- category, city, area, relevance, newest, and popular controls;
- event-built follower/product/like/comment counters needed by V1 cards;
- popular ranking signals: likes, comments, confirmed orders, time decay;
- abuse/rate controls and deterministic cursor behavior;
- no embeddings, GPS radius, public order counts, or domain ownership.

Pricing:

- public/default price reads for anonymous published products;
- authenticated five-level resolution;
- unknown non-CRM customers skip personal/group/customer-list levels;
- immutable order snapshots remain mandatory.

Acceptance: projection rebuild is idempotent and never becomes pricing,
company, catalog, or order authority.

## Step 5: account/profile, customers, invites, feature flags

**Create/rework:** account/profile ownership, `customers`, `invites`,
`feature-flags`.

Required capabilities:

- own avatar/name/username/contact verification, language/theme preferences;
- phone/email OTP everywhere; Google provider exposed on Android only;
- account-deletion request/cancel/finalize, re-auth, grace period, retention,
  and company-owner consequences;
- customers/groups/counterparties/legal profiles and five-level assignments;
- CRM creation only by checkout, staff, or accepted customer invite;
- pre-order chat/social actions never create CRM;
- invite create/share/redeem/revoke/expiry without auto-follow;
- real flag/entitlement reads for locked V1 states.

Tests: cross-user account isolation, contact uniqueness, deletion lifecycle,
invite replay/expiry, multi-company CRM isolation.

## Step 6: orders, payments, delivery

**Rework/create:** `orders`, `payments`, `delivery`.

Required capabilities:

- authenticated synchronized carts and V1 checkout view models;
- checkout validation, idempotency, CRM link/create, five-level snapshots;
- customer list/get and cancel-before-confirmation;
- staff list/get/create/edit/confirm/cancel, order log, chat collaboration
  actions;
- fixed machine statuses with company label/color customization;
- D1-compliant stock validation/decrement;
- invoice/manual launch payment records and events; acquiring remains later;
- Nova Poshta city/branch/locker/street/courier plus company pickup.

Tests: money snapshots, duplicate checkout, cancellation cutoff, stock races,
delivery validation, cross-tenant/ownership, event/outbox behavior.

## Step 7: chat, notifications, realtime

**Rework/create:** `chat`, `notifications`.

Required capabilities:

- account/customer grouped unified inbox across company contexts; staff inbox;
- realtime text, pagination, reconnect/catch-up, offline retry, edit/delete,
  reply, reactions, typing, presence, read/unread;
- file/image/voice attachments and product mentions;
- order/document cards store only IDs/revisions;
- recap composed from principal-compatible orders/catalog/files/documents
  reads, never copied domain state;
- device registration and generic notification intent/delivery/preferences;
- initial push/in-app/email families: chat, order, document/signing;
- followed-company new-product preference is an explicit later opt-in.

Tests: participant authorization, sequence/idempotency, reconnect dedupe,
attachment ownership, grouped inbox isolation, projection replay.

## Step 8: documents and QES

**Create:** `documents`, `doc-generation`, `doc-signing`.

Required capabilities:

- mobile list/create/edit/generate/view/send;
- order/counterparty/requisite/totals snapshots;
- PDF generation worker and file ownership;
- prepare/finalize/verify signing around on-device key processing;
- ASiC-E artifacts, pki-proxy, both-party signing, chat cards;
- AI may prepare/navigate but cannot perform the human/device-bound signature.

Tests: authorization, immutable snapshots, generation idempotency, signature
vectors/verification, key-never-leaves-device boundary, retry/event behavior.

## Step 9: assistant and client-safe UI tools

**Create:** assistant spec and UI-tool contract.

Required capabilities:

- contextual global text overlay without replacing V1 tabs;
- current screen/entity context allowlist;
- the same action descriptors, permissions, confirmations, and output
  validation as classic UI;
- navigate/open/prefill handoffs and resumable confirmation flows;
- no alternate business API or hidden domain state.

Acceptance: every launch action is either safely callable or has an explicit
human/device handoff; AI cannot bypass risk metadata.

## Final consistency review

- [ ] Public reads expose only published allowlisted facts.
- [ ] Social writes require auth and verified target resolution.
- [ ] Public counters exist; follower/liker identities and user search do not.
- [ ] No discovery/social/chat action creates CRM.
- [ ] Search and chat projections never own domain state.
- [ ] Meta, embeddings, GPS radius, reviews, and V1 data migration are absent.
- [ ] Every P1 screen behavior maps to an approved action/event/local state.
- [ ] Every new/changed action has mandatory metadata and DoD test cases.
- [x] D1 stock atomicity is resolved by ADR-0021; its core protocol remains an
      implementation prerequisite.
- [ ] UX gate remains closed until revised DEFINE/SYSTEM/prototype approvals.
