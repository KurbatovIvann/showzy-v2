# Catalog — AI Journey

> Status: Approval #2 granted by the owner on 2026-08-17  
> Linear: SHO-10 · Quadrants: Staff/AI, Customer/AI  
> Evidence: scope-level constraints and internal assumptions; no approved
> catalog spec exists

## Context and preconditions

Staff AI starts in a visible company scope or from Catalog/product/pricing.
Customer AI starts globally for discovery or within a company/product/cart.

- AI invokes only exposed actions for the active principal.
- Current product, visibility, and resolved price are read before proposal.
- Every write has a structured preview.
- Media, dense variant review, and high-risk changes use classic UI.

## Staff path

1. Ask AI to find, prepare, or change a product.
2. Confirm active company and disambiguate the product.
3. Read current product facts or collect only future contract-defined fields.
4. Hand media selection, variant matrices, and dense comparison to the
   prefilled classic form.
5. Preview target, fields, visibility effect, and reversibility.
6. After approval, invoke the same catalog action as classic UI.
7. Report the committed result and refresh the product card.
8. Route price-list/personal/group work to Pricing, not Catalog.

## Customer path

1. Ask globally for a company/product or ask within a visible company.
2. Global search returns only published projection cards.
3. Selecting a result invokes an independently resolved company read.
4. Show current facts, visible variants, and effective price from Pricing.
5. Preview company, product, variant, quantity, and cart effect.
6. After approval, update the canonical cart shared with classic UI.
7. Continue in AI or open classic visual comparison/cart/checkout.
8. Browsing/cart creates no CRM relationship.

## AI ↔ classic handoffs

- Carry role, company/product/variant IDs, explicit unsaved draft, and return
  route.
- Never copy product, publication, or price state as authority.
- Refresh state after classic completion and before a later write.
- AI remains distinct from business chat and the accountable human actor.

## Recovery and boundaries

- `catalog`, `pricing`, `files`, `orders`, and `search` retain separate source
  ownership; AI owns none of them.
- Streaming text cannot claim search/save/cart success before tool completion.
- Preserve collected fields as a labeled unsaved draft after failure.
- Offline AI may prepare intent but cannot save, publish, resolve current
  price, or mutate cart.
- Repeated approval reuses one pending mutation attempt.
- Retry media upload, catalog save, and card rendering separately.
- AI cannot accept a company ID as authority or expose private product
  existence.

## Accessibility and internal evaluation

Use stable cards, predictable headings/actions, non-streaming completion, and
announced tool state. Distinguish Drafted, Ready to save, and Saved. Provide
image alternatives and non-color visibility/risk.

Internally test Staff preparation→classic review, pricing handoff, published
discovery only, Customer context transition, shared cart, repeated approval,
offline/permission states, and screen-reader flow. Exact actions and fields
remain provisional until an approved catalog spec. Label findings
`internal evaluation only`.
