# Catalog products — golden mobile slice

Copy this tree for the next staff module. `src/app/` stays one-line
re-exports. Feature code lives here, not under
`src/components/screens/<feature>/`.

Later tickets rewrite internals (RHF on the form, XState v6 on photos).
This folder is the layout contract now.

## Folders (one role each)

| Folder    | Owns                                                                                  | Does not own                                                             |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `api/`    | Query options, mutation binders, archive invalidation                                 | JSX, RHF, XState                                                         |
| `list/`   | List screen, view, hook, presenter, row, thumbnails                                   | Writes, photo session                                                    |
| `detail/` | Detail screen, view, facade hook, sheets                                              | Form field state, photo machine                                          |
| `form/`   | Create/edit screen, view, draft model, save                                           | List filters; photo session internals                                    |
| `photos/` | Photo hook/model, upload runner, native, picker                                       | A second `catalog.getProduct` when the parent already has `imageFileIds` |
| `shared/` | Permissions, presenters (`variant-count`), sheet chrome used by more than one surface | Transport                                                                |

## Copy-me rules

- **Query vs RHF vs XState vs view.** TanStack Query stays in `api/` and
  surface hooks. Form fields belong in RHF (not the detail/list hooks).
  Photo session belongs in XState v6. List filters and sheet chrome are
  not XState. Views take a view-model and callbacks.
- **No second `getProduct`.** If the parent already has `imageFileIds`,
  hydrate photos from that list. Do not start another `catalog.getProduct`
  for thumbnails.
- **Kebab-case files**, PascalCase component exports.
- **Screens do not own transport.** Routes re-export a screen. Screens
  compose a hook + view. Hooks call `api/` binders. Never import
  `@showzy/core`.
