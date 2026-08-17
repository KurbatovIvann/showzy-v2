# Direct Link — AI Journey

> Linear: SHO-27 · Context: Public preview → Customer-company AI  
> Also applies: `entry-path-conventions.md`

## Purpose and path

Continue a company/product direct link into AI while preserving public limits,
authentication intent, and separate company-scoped authorization.

1. Preserve target through install and launch.
2. Show a pending target card without asserting availability.
3. Invoke the typed `public` preview resolver.
4. Render the current published company/product card.
5. User asks a question or chooses a company action.
6. AI hands off to sign-in where required.
7. After sign-in, a `customer` action resolves the target again.
8. Replace preview with current authenticated company/product state.
9. Preview and invoke the same canonical cart action as classic UI.
10. Create no CRM row; later checkout links/creates it.

## AI ↔ classic

**Open profile**, **Choose options**, and **Review cart** open canonical
screens. Classic UI returns with stable IDs; AI refetches rather than trusting
conversation text or cached cards.

## Journey-specific recovery and evaluation

Offline retains target but claims no availability. Unpublished/private targets
suppress details. Product unavailability disables cart. Failed install
continuation provides deterministic classic recovery.

Internally verify public-vs-customer distinction, arbitrary-link denial, exact
target restoration, one shared cart, and no pre-checkout CRM row.
