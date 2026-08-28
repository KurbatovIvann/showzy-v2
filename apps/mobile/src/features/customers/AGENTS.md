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
`list/`, `groups/`, or `counterparties/`. The client Юрособи list uses
`api/` + `shared/` hrefs. Picker chrome (`OptionSelectSheet`,
`SelectorRow`) lives in `shared/`. `optionSelectItems` and
`selectorLookupValue` stay in `form/customer-form-pickers.ts` (SHO-181
golden); group and counterparty forms import them from there — do not
move those helpers into `shared/`. The group form (SHO-181) lives in
`groups/` next to the list presenter, copying the same RHF / UI Zod /
save loop. The counterparty form (SHO-196) lives in `counterparties/`
next to the list presenter.

## Folders (one role each)

| Folder            | Owns                                                                                                                                                                                                               | Does not own                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `api/`            | list/query binders, status and delete mutations, `getCustomer` / `getGroup` / `getCounterparty`, `listCounterparties` / `deleteCounterparty`, form mutations, cache invalidation keys                              | JSX, RHF                                           |
| `list/`           | Home screen, view, composer hook, clients presenter/row, `use-client-writes`. Top chrome is shared `TabView` + `SegmentedTabs` `layout="scroll"` (full-bleed swipe scenes; not `BottomNav`)                        | Group/counterparty row internals, form fields      |
| `groups/`         | Groups presenter, composer hook, group row, `use-group-writes`, create/edit group form (RHF, UI draft Zod, save loop, unsaved guard). Price-list picker reuses `shared/OptionSelectSheet`                          | Client filters; client form fields; counterparties |
| `counterparties/` | Counterparties presenter, composer hook, row, `use-counterparty-writes`, create/edit form (RHF, UI draft Zod, save loop, unsaved guard). Search is name/EDRPOU. Delete is protocol confirmation (`customers:edit`) | Client filters; invitations; client form fields    |
| `form/`           | Create/edit client screen, view, UI draft Zod, RHF fields, save loop, unsaved guard, picker lookups, archive/restore/delete on the editor, Юрособи list via `api/`                                                 | List filters; group form; `counterparties/`        |
| `shared/`         | Permissions, hrefs, caps, initials, count labels, protocol-confirm helper, paged-list helpers, lookup drain, entity card chrome, debounce, `OptionSelectSheet`, `SelectorRow`                                      | Transport                                          |

Do not add a feature-local tab bar. Compose `TabView` + `SegmentedTabs`
from `src/components/ui/` (decision table in
`docs/design/mapping/mp-to-mobile.md`).
