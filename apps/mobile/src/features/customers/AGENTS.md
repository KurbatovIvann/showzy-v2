# Customers — mobile CRM slice

Copy `src/features/catalog/products/` folder roles. `src/app/` stays
one-line re-exports. Feature code lives here.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. List filters
and tab chrome are `useState` / local view state, never XState. Writes
on the list (archive / restore / delete) use `useContractMutation`.
Delete re-invokes with the confirmation challenge (protocol). Archive
is a UI confirm only. Catalog list does not own writes; this slice does,
because archive / restore / delete live on the row.

The client form (SHO-180) copies catalog `form/`: RHF `Controller`, UI
draft Zod, save planner, unsaved-leave guard. `form/` must not import
`list/`. Pickers live in `shared/` so the group form can reuse them.

## Folders (one role each)

| Folder    | Owns                                                                                                                                                                                        | Does not own                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `api/`    | list/query binders, status and delete mutations, `getCustomer`, form mutation, cache invalidation keys                                                                                      | JSX, RHF                         |
| `list/`   | Home screen, view, composer hook, clients presenter/row, `use-client-writes`. Top chrome is shared `TabView` + `SegmentedTabs` `layout="scroll"` (full-bleed swipe scenes; not `BottomNav`) | Group row internals, form fields |
| `groups/` | Groups presenter, composer hook, group row, `use-group-writes`                                                                                                                              | Client filters                   |
| `form/`   | Create/edit client screen, view, UI draft Zod, RHF fields, save loop, unsaved guard, picker lookups, archive/restore/delete on the editor                                                   | List filters; group form         |
| `shared/` | Permissions, hrefs, caps, initials, count labels, protocol-confirm helper, paged-list helpers, lookup drain, entity card chrome, debounce, `OptionSelectSheet`, `SelectorRow`, group editor placeholder   | Transport                        |

Do not add a feature-local tab bar. Compose `TabView` + `SegmentedTabs`
from `src/components/ui/` (decision table in
`docs/design/mapping/mp-to-mobile.md`).

Group create/edit forms are SHO-181. This slice only navigates to those
routes (placeholder until that ticket lands).
