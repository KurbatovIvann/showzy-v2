# Empty State Contract

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-17 · Authoritative loaded emptiness only

## Use and interface

Use only after an authorized read succeeds with no displayable items. Never
mask loading, failure, offline uncertainty, permission denial, partial data, or
private/unpublished existence.

Conceptual inputs: kind, localized title/explanation, safely disclosed scope,
query/filter summary, one primary action, optional decorative illustration.

Variants: first use, filtered empty, search no-results, contextual empty.
Failure/restricted/unavailable/unresolved are excluded.

## Behavior and content

- Filtering to empty does not move focus; new screen follows title focus.
- Recovery preserves query, draft, company context, and return position.
- Clearing filters changes only disclosed filters.
- Name what is empty and why; offer one useful Create, Clear filters, Edit
  search, or Browse action.
- Avoid blame, fabricated suggestions, false reassurance, and existence leaks.
- Localize query quotation, counts, plurals, and accessible labels.
- Heading, explanation, and action are separate accessible elements.
- Decorative illustration is hidden; informative art needs purpose-specific
  alternative.

## Dual-flow and tokens

Classic distinguishes first-use/filter/no-results. AI exposes interpreted
query/filters and never fabricates results or private objects. Empty generative
cards provide equivalent text and classic destination; rendering failure is an
error, not empty.

Use `colors.semantic.surface|text|status.neutral|action|focus`, `space.*`,
`dimensions.touch.minimum|icon.*`, `typography.role.*`, and `motion.*` from
`tokens.md`.

## Acceptance

- Fixtures prove loading/error/offline/permission/private cases cannot render
  empty.
- Focus/announcement, 44×44 action, 200% text, contrast, localization,
  reduced motion, and Classic/AI parity pass.
