# ADR-0028: Customer is the commercial spine; invite accept creates CRM

- **Status**: Accepted
- **Date**: 2026-08-28
- **Deciders**: owner (+ Cursor Grok 4.6)
- **Amends**: ADR-0018 (CRM creation list only). Does not change the
  `consumer` principal, discovery visibility, or ADR-0020 / ADR-0022
  “browse / share do not create CRM” rules.

## Context

The staff Customers surface has four tabs — Clients, Groups,
Counterparties, Invitations. The Magic Patterns canvas models those as
unrelated records. That matches a staff habit of splitting “regular” and
“business” people, but it breaks the destination product:

- Five-level pricing (personal → client list → group list → default list
  → base) resolves only through a `company_customers` row. A counterparty
  has no group or price list.
- Public / authenticated storefront visitors without a CRM row see only
  default-list and base prices (levels 4–5). Group prices for an invited
  coffee shop never appear unless accept creates or enriches CRM.
- Documents need a legal face (ЄДРПОУ, IBAN). Orders, chat, and pricing
  need a commercial face. One coffee shop is often both. One CRM customer
  may operate several ФОП / ТОВ. A counterparty may exist with no buyer
  relationship (one-off document, non-customer).
- ADR-0018’s introduction says an invite “creates or enriches a CRM
  relationship,” while its CRM section allowed creation only by staff or
  checkout. Archived invite journeys followed the narrower rule. That
  contradiction must close before the customers / invites slices start.

Owner decisions (2026-08-28): one customer may have several legal
entities; a counterparty may exist without a customer; invite accept
creates CRM; both staff and the customer may fill legal requisites; the
four tabs stay as screens, not as four domain models.

## Decision

The **CRM customer** is the commercial spine of a company relationship.
A **counterparty** is a company-owned legal face for documents. They are
linked, not merged, and not two kinds of buyer.

Rules:

1. **Orders, chat, groups, and price lists** attach to
   `company_customers` only. Groups and price lists never hang on a
   counterparty.
2. **Documents and QES** use a counterparty (live link + immutable
   snapshots). `counterparties.customer_id` is optional. One customer may
   have many counterparties. A counterparty with no customer is allowed.
3. **B2B is not a separate flow.** It is a CRM customer that also has
   (or will have) a legal face — same order path, extra document actions
   (`docs/scope.md` §1.1).
4. **CRM rows are created only by:**
   - staff adding the customer; or
   - checkout / staff order creation atomically linking or creating the
     record (`customers.ensureCrmRecord` or the staff create path); or
   - **invite accept**, which creates or enriches the CRM row and applies
     the token’s `group_id` and `price_list_id` (fill empty assignments;
     do not silently overwrite staff-set values).
5. **Discovery, profile, cart, chat, and direct-link entry** still create
   no CRM row. Document share / co-sign still create no CRM row
   (ADR-0022).
6. **Invites on this surface are customer-entry tokens**, owned by
   `invites`. They are not staff/team invites (`companies`). Canvas roles
   “manager” / “partner” are not this module. Accept does not create a
   counterparty. Chat bootstrap on accept is a later slice, not implied
   here.
7. **Legal requisites have two writers.** The customer upserts their
   account-scoped legal profile. Staff create and edit company-scoped
   counterparties. Either side may copy the other into a company
   counterparty (explicit attach/copy, not a silent merge). The account
   profile stays portable across companies.
8. **Staff UI.** Four tabs remain views over this model. The client card
   shows linked counterparties; the counterparty card shows the linked
   customer when one exists. The canvas must not be ported as four
   disconnected types.

Composition: invite accept invokes a `customers` write in the same
accept transaction (exact action name lands in the feature card). The
`invites` module still owns tokens and redemption state.

## Alternatives considered

- **One “party” row (person | legal)** — rejected: one customer with two
  legal entities, a non-buyer counterparty, document delete-restrict vs
  CRM delete, and account-scoped vs company-scoped requisites do not fit
  one table. Would need a new ADR and a v1 break.
- **Counterparty is the business customer** — rejected: pricing and
  checkout already key off `company_customers`; invites land a person in
  CRM; the storefront would not know whom to price.
- **Two directories with no link** (current canvas) — rejected: the same
  person is duplicated; group prices never reach the legal face; a
  document cannot be constrained to the order’s customer.
- **Invite accept creates no CRM** (archived journeys) — rejected: the
  invited coffee shop would see retail prices until checkout, so the
  invite cannot carry group or price-list intent.

## Consequences

- ADR-0018’s CRM list gains invite accept. Browse / cart / chat / share
  remain non-creating.
- Archived invite journeys and entry-path CRM notes that forbade
  invite-created CRM are superseded by this ADR. They are not authority
  (`docs/design/define/journeys/README.md`).
- `customers` owns counterparties and customer legal profiles
  (`docs/module-ownership.md`). `documents` snapshots requisites; it does
  not own the live counterparty directory.
- Owner-first build order stays: CRM + groups with the panel (needed by
  `orders.create`); counterparties with documents; invites when that
  slice starts — the accept → CRM contract is already frozen.
- A later `/feature` must not invent a fifth CRM creator, hang pricing
  on counterparties, or treat canvas invite “manager” as a customers
  action.
