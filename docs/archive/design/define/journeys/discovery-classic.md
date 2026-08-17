# Discovery — Classic UI Journey

> Linear: SHO-27 · Context: Global consumer → Customer company  
> Also applies: `entry-path-conventions.md`

## Purpose and path

Enable an authenticated consumer to search/browse published companies and
products, enter one visible company, and build its canonical cart.

1. Open **Discover** in Global context.
2. Enter query/category/filters; preserve them with scroll position.
3. A `consumer` read returns published companies and active published products.
4. Results identify company/product without social popularity signals.
5. Select a result; a separately resolved company action refetches visibility.
6. The shell changes visibly to `Customer · <company>`.
7. Browse current catalog/product/variant and add to the company cart.
8. Continue browsing, open cart/chat, or ask AI.
9. At checkout, link/create CRM atomically and continue to the order chat.

## Classic ↔ AI

**Ask AI** carries query, filters, and stable IDs. **View all results** returns
to the same list. Product/profile/cart handoffs always refetch current state.

## Journey-specific recovery and evaluation

No-results offers query editing, filter clearing, and category browse. Stale
results disappear or become neutral unavailable states. Product unavailability
blocks cart mutation and returns to the current catalog.

Internally verify Global→company context recognition, query/filter retention,
published-only results, canonical cart parity, and no CRM side effect before
checkout.
