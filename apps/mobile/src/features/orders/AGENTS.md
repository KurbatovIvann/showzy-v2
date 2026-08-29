# Orders — mobile list slice (SHO-211)

Copy `src/features/catalog/products/` folder roles and customers list
chrome. `src/app/` stays one-line re-exports. Feature code lives here.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. List filters
and the status-filter sheet are `useState` / local view state, never
XState. Views take a view-model and callbacks.

Do not import `src/features/customers/` from this slice. Hydrate names
with `customers.getCustomer` through `@showzy/contract` (binder in
`api/customer-name-query.ts`). Do not join customers in the orders
backend module.

## Folders (one role each)

| Folder    | Owns                                                                                          | Does not own                          |
| --------- | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| `api/`    | `orders.list` infinite binder, `customers.getCustomer` name hydration                         | JSX, other modules' query files       |
| `list/`   | Screen, view, composer hook, presenter, row, filter sheet, customer-name queries              | Detail / editor (SHO-212 / SHO-213)   |
| `shared/` | Permissions, hrefs, item-count labels                                                         | Transport                             |

`list/` must not grow a combined `*-model.ts`. Query keys are
`[actionName, companyId, input]` (SHO-102). Empty selected statuses map
to `orders.list` `status: "all"`. No search. No payment filter.
