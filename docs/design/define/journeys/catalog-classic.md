# Catalog — Classic UI Journey

> Status: Complete; pending DEFINE Approval #2  
> Linear: SHO-10 · Quadrants: Staff/Classic, Customer/Classic  
> Evidence: scope-level constraints and internal assumptions; no approved
> catalog spec exists

## Context and preconditions

Staff enter from `Staff · company` More, a product reference, or an AI-prepared
draft. Customers enter from authenticated discovery, invite, direct link,
company profile, chat mention, or AI result.

- Staff membership and catalog permission are verified.
- Customer/public reads independently prove company/product visibility.
- Catalog owns product/variant/publication/base-price facts; pricing resolves
  the effective price.
- Network access is required for authoritative writes.

## Staff path

1. Open Catalog and scan products by category and text-labeled
   active/publication state.
2. Open or start a product using only fields later approved by the catalog
   spec.
3. Add permitted variants and authorized media.
4. Preview customer-visible content and the visibility effect.
5. Review base-price facts; open Pricing for personal/list/group/default
   rules.
6. Save once through a typed action and reload current product state.
7. Open customer preview only when current visibility permits it.

## Customer path

1. Reach a published company/product through discovery, invite, or direct link.
2. Recheck current visibility; links/results grant no access.
3. Browse only active published products and approved categories.
4. Open a product and review current description, media, variants, and
   effective displayed price.
5. Select variant/quantity and update the canonical company cart.
6. Continue browsing, ask AI, review cart, or proceed to account-required
   checkout.
7. Browsing/cart activity creates no CRM row.

## Classic ↔ AI handoffs

- Staff AI can prepare fields; media, variant matrices, bulk/dense review, and
  consequential visibility changes return to classic UI.
- Customer AI can explain products; visual comparison, precise variants, and
  cart review return to classic UI.
- Carry stable IDs and explicit drafts, not authoritative product/price copies.
- Refresh product, visibility, and effective price after handoff.

## Ownership and recovery

- `catalog` owns products, variants, categories, media links, active/published
  state, and base price; `files`, `pricing`, `orders`, and `search` retain
  their own state.
- Loading keeps filters/layout stable. Empty staff, category, customer
  catalog, and discovery no-results states remain distinct.
- Preserve fields and successful uploads after validation/network failure.
- Never guess a price when resolution fails.
- Offline may keep a labeled local staff draft or cart intent, but visibility,
  price claims, saves, and cart writes wait for current state.
- Retry upload and product save separately; same-attempt save creates one
  product.
- Foreign/private products disclose no existence.

## Accessibility and internal evaluation

Expose product, effective price, publication, active state, selected variant,
and action in logical order. Media has useful alternatives; variants expose
selected/unavailable semantics; no state is color-only.

Internally test phone product/media/variant editing, base-vs-effective pricing,
all entry paths, unavailable products, shared cart, handoffs, offline drafts,
and cross-tenant denial. Exact fields/transitions remain blocked on a future
approved catalog spec. Label findings `internal evaluation only`.
