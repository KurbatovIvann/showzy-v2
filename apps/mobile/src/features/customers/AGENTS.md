# Customers — mobile CRM list slice

Copy `src/features/catalog/products/` folder roles. `src/app/` stays
one-line re-exports. Feature code lives here.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. List filters
and tab chrome are `useState` / local view state, never XState. Writes
on the list (archive / restore / delete) use `useContractMutation`.
Delete re-invokes with the confirmation challenge (protocol). Archive
is a UI confirm only. Catalog list does not own writes; this slice does,
because archive / restore / delete live on the row.

## Folders (one role each)

| Folder    | Owns                                                                                                                                            | Does not own                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `api/`    | list/query binders, status and delete mutations, cache invalidation keys                                                                        | JSX, RHF                         |
| `list/`   | Home screen, view, composer hook, clients presenter/row/tabs, `use-client-writes`                                                               | Group row internals, form fields |
| `groups/` | Groups presenter, composer hook, group row, `use-group-writes`                                                                                  | Client filters                   |
| `shared/` | Permissions, hrefs, caps, initials, count labels, protocol-confirm helper, paged-list helpers, entity card chrome, debounce, editor placeholder | Transport                        |

Create/edit forms are SHO-180 / SHO-181. This slice only navigates to
those routes (placeholder until those tickets land).
