# Companies — mobile settings hub (SHO-226)

Copy `src/features/catalog/products/` folder roles. `src/app/` stays
one-line re-exports. Feature code lives here, not under
`src/components/screens/`.

This slice is the More → Налаштування компанії hub. It binds
`companies.get` (read). The legal editor (SHO-225) is out of scope; the
legal row hrefs to `/more/company/legal` (stub until that ticket).

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. Hub load
classification is a pure presenter. No RHF, no writes, no XState.

## Folders (one role each)

| Folder    | Owns                                                                    | Does not own                    |
| --------- | ----------------------------------------------------------------------- | ------------------------------- |
| `api/`    | `companies.get` query binder and cache key                              | JSX, permissions, hrefs         |
| `hub/`    | Screen, view, composer hook, presenter, settings row, legal-editor stub | Form fields, profile/slug write |
| `shared/` | `settings:payments` affordances, hrefs                                  | Transport                       |

`hub/` must not invent a profile write or ФОП/ТОВ editor. Domain reads go
through `@showzy/contract`. Do not import `@showzy/db` or `@showzy/core`.
