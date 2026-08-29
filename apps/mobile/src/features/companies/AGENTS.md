# Companies — mobile settings hub + legal editor (SHO-226 / SHO-225)

Copy `src/features/catalog/products/` folder roles. `src/app/` stays
one-line re-exports. Feature code lives here, not under
`src/components/screens/`.

The More → Налаштування компанії hub binds `companies.get` (read). The
legal editor (`form/`) binds `companies.get` to hydrate and
`companies.updateLegal` to save. Copy counterparty form chrome: RHF, UI
Zod, save planner, unsaved-leave. Do not call `companies.get` when
`canViewCompanySettings` is false.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. Hub load
classification is a pure presenter. Form fields are RHF + UI Zod. No
XState. No ФОП-registry quick-fill. Named deviation: ship ФОП/ТОВ
(canvas is ФОП-only).

## Folders (one role each)

| Folder    | Owns                                                                                 | Does not own                         |
| --------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| `api/`    | `companies.get` query binder, `updateLegal` mutation binder, cache invalidation keys | JSX, permissions, hrefs              |
| `hub/`    | Settings screen, view, composer hook, presenter, settings row                        | Form fields, profile/slug write      |
| `form/`   | Legal editor screen, view, UI draft Zod, RHF fields, save loop, unsaved guard        | Hub chrome, profile/slug, quick-fill |
| `shared/` | `settings:payments` affordances, hrefs, field caps                                   | Transport                            |

`hub/` must not invent a profile write. `form/` must not import `hub/`.
Domain reads and writes go through `@showzy/contract`. Do not import
`@showzy/db` or `@showzy/core`.
