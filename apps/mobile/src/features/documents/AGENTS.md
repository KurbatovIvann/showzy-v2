# Documents — mobile list slice (SHO-237)

Copy `src/features/catalog/products/` folder roles and customers list
chrome. Options-sheet **writes** copy `src/features/pricing/list/`
(catalog list does not own writes). `src/app/` stays one-line
re-exports. Feature code lives here, not under
`src/components/screens/`.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. List filters
and options-sheet chrome are `useState` / local view state, never XState.
Writes on the list (share / cancel) use `useContractMutation`. Cancel is
UI confirm (`presentConfirmDialog`) after the options sheet hides — the
action does not declare protocol confirmation. Share mints the page
token once per sheet session; do not log the raw token or signed URL.

This ticket is the list only. Do not add `form/` or a create editor
(`/documents/new` may 404 until SHO-238). Do not add a public
`/d/[token]` route.

## Folders (one role each)

| Folder    | Owns                                                                                                                                                        | Does not own            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `api/`    | `documents.list` infinite binder, `documents.get`, cancel/share mutations, cache keys                                                                       | JSX, RHF                |
| `list/`   | Screen, view, composer hook, presenter, row, options sheet, handover sheet, list writes. Filter chips are `ChoiceField` (not `BottomNav` / `SegmentedTabs`) | Create editor (SHO-238) |
| `shared/` | Permissions, hrefs, ids, issued-on formatting, mutation banners                                                                                             | Transport               |

`list/` must not grow a combined `*-model.ts`. Query keys are
`[actionName, companyId, input]` (SHO-102). Type filter maps onto
`documents.list` `type`. Optional `orderId` is a query param, never an
access grant. No search. Row buyer label is the list snapshot
(`buyerLabel`), not a live CRM join. Generation status and the panel PDF
URL come from `documents.get` on the options / open-PDF path — not from
an N+1 get on every list row, and not from a list-row `generation`
field (the list contract has none).

Do not import `@showzy/db` or `@showzy/core`. Domain reads and writes go
through `@showzy/contract`.
