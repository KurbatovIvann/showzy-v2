# Pricing — mobile price-list slice (SHO-189)

Copy `src/features/catalog/products/` folder roles and customers list
chrome. `src/app/` stays one-line re-exports. Feature code lives here.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. List filters
and options-sheet chrome are `useState` / local view state, never XState.
Writes on the list (default / active / delete) use `useContractMutation`.
Delete is UI confirm (`presentConfirmDialog`) then protocol confirmation
(`submitWithProtocolConfirmation`). Catalog list does not own writes; this
slice does, because default/active/delete live on the options sheet.

The editor form and entry grid are SHO-190. This slice only navigates to
those routes (placeholder until that ticket).

## Folders (one role each)

| Folder    | Owns                                                                                                                                        | Does not own                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `api/`    | list binders with `query` + `availability`, status and delete mutations, cache invalidation keys                                            | JSX, RHF, the customers picker binder |
| `list/`   | Screen, view, composer hook, presenter, row, options sheet, list writes. Filter chips are `ChoiceField` (not `BottomNav` / `SegmentedTabs`) | Editor form fields                    |
| `editor/` | Placeholder create/edit route until SHO-190                                                                                                 | Entry grid, bulk %                    |
| `shared/` | Permissions, hrefs, caps, entry-count labels, protocol-confirm helper, mutation banners, ids, debounce                                      | Transport                             |

Do not import `apps/mobile/src/features/customers/api/price-list.queries.ts`
from this slice — that binder stays picker-safe (`{}` / `{ limit }`). List
reads with `query` / `availability` live here. Do not import `@showzy/db`
or `@showzy/core`. Domain reads/writes go through `@showzy/contract`.
