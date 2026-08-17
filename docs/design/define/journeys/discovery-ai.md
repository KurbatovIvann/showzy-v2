# Discovery — AI Journey

> Linear: SHO-27 · Context: Global AI → Customer company  
> Also applies: `entry-path-conventions.md`

## Purpose and path

Enable an authenticated consumer to express discovery intent and receive the
same published results, company objects, and cart as classic UI.

1. Ask global AI for a company/product.
2. AI exposes interpreted query/filters before or with execution.
3. A `consumer` action returns current published matches.
4. Render structured company/product cards with stable IDs.
5. Selection invokes a separately resolved company read.
6. Show the visible company scope before any company action.
7. On add-to-cart request, preview company/product/variant/quantity.
8. Invoke the same canonical cart action and show verified completion.
9. Offer **Show all results**, **Open profile**, and **Review cart**.
10. Checkout later links/creates CRM and opens the order chat.

## AI ↔ classic

Classic results preserve interpreted filters; dense comparison/variant choice
uses classic UI. Returning to AI refreshes the selected object and cart.

## Journey-specific recovery and evaluation

Pending uses a stable card and Stop action. No-results exposes interpreted
filters. Offline retains the prompt but claims no current availability.
Unavailable cards are replaced, not narrated from cache.

Internally verify filter correction, Global→company scope, arbitrary-ID denial,
one shared cart, and no pre-checkout CRM row.
