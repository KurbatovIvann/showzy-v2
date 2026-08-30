# Documents — mobile list + create + public token (SHO-237 / SHO-238)

Copy `src/features/catalog/products/` folder roles and customers list
chrome. Options-sheet **writes** copy `src/features/pricing/list/`
(catalog list does not own writes). Create copies product/customer form
(RHF + UI Zod + planner + unsaved-leave) and orders picker chrome.
`src/app/` stays one-line re-exports. Feature code lives here, not under
`src/components/screens/`.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. List filters
and options-sheet chrome are `useState` / local view state, never XState.
Writes on the list (share / cancel) use `useContractMutation`. Cancel is
UI confirm (`presentConfirmDialog`) after the options sheet hides — the
action does not declare protocol confirmation. Share mints the page
token once per sheet session; do not log the raw token or signed URL.

Create is `/documents/new` only (no edit snapshots). Totals come from
the server snapshot — do not reprice on the client. Public `/d/[token]`
is an in-app Expo route that calls `documents.getShared`; the API HTML
landing stays in SHO-235.

## Folders (one role each)

| Folder    | Owns                                                                                                                                                             | Does not own                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `api/`    | `documents.list` infinite binder, `documents.get`, cancel/share/create mutations, order/counterparty lookups, `documents.getShared`, cache keys                  | JSX, RHF                           |
| `list/`   | Screen, view, composer hook, options chrome hook, presenter, row, options sheet, list writes. Filter chips are `ChoiceField` (not `BottomNav` / `SegmentedTabs`) | Create editor, public token screen |
| `form/`   | Create editor: schema, draft, plan, save, load, copy, pickers, unsaved-leave, screen/view. Type cards are not list `ChoiceField`                                 | List, public HTML landing          |
| `share/`  | Handover sheet/chrome (list + form), public `/d/[token]` screen                                                                                                  | Form RHF, list filters             |
| `shared/` | Permissions, hrefs, ids, share-token parse, issued-on formatting, mutation banners, lookup caps                                                                  | Transport                          |

`list/` must not grow a combined `*-model.ts`. Query keys are
`[actionName, companyId, input]` (SHO-102) for staff actions. Public
`documents.getShared` keys `[actionName, null-company, { token }]` and
does not send `companyId`. Type filter maps onto `documents.list`
`type`. Optional `orderId` is a query param, never an access grant. List
has no search. Row buyer label is the list snapshot (`buyerLabel`), not
a live CRM join. Generation status and the panel PDF URL come from
`documents.get` on the options / open-PDF path — not from an N+1 get on
every list row, and not from a list-row `generation` field (the list
contract has none).

**`form/` must not import `list/`.** Shared hrefs, permissions, and
handover helpers live in `shared/` or `share/`. Copy picker chrome into
`form/` — do not import `features/orders` or `features/customers`.

Do not import `@showzy/db` or `@showzy/core`. Domain reads and writes go
through `@showzy/contract`.
