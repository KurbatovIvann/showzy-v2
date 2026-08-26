# Catalog products — golden mobile slice

Copy this tree for the next staff module. `src/app/` stays one-line
re-exports. Feature code lives here, not under
`src/components/screens/<feature>/`.

The form still uses a draft hook (RHF is SHO-159). Photos is the XState
v6 session (SHO-158): pin exact `xstate` / `@xstate/react` in
`apps/mobile/package.json` — no floating `@alpha` tag.

## Folders (one role each)

| Folder    | Owns                                                                                    | Does not own                                                             |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `api/`    | `product.queries.ts`, mutation binders, `product-cache.ts` invalidation keys            | JSX, RHF, XState                                                         |
| `list/`   | Screen, view, composer hook, presenter, row, `use-product-thumbnails.ts`                | Writes, photo session                                                    |
| `detail/` | Detail screen, view, facade hook, sheets                                                | Form field state, photo machine                                          |
| `form/`   | Create/edit screen, view, draft model, save                                             | List filters; photo session internals                                    |
| `photos/` | XState v6 session, thin manager hook, commit/runtime I/O, upload runner, native, picker | A second `catalog.getProduct` when the parent already has `imageFileIds` |
| `shared/` | Permissions, presenters (`variant-count`), sheet chrome used by more than one surface   | Transport                                                                |

## Copy-me rules

- **Query vs RHF vs XState vs view.** TanStack Query stays in `api/` and
  surface hooks. Form fields belong in RHF (not the detail/list hooks).
  Photo session belongs in XState v6. `use-product-photos.ts` composes the
  session with Query (download URLs) and the commit/runtime drivers — it
  does not own slots or the handshake. List filters and sheet chrome are
  not XState. Views take a view-model and callbacks. `use-products-list.ts`
  stays a thin composer: filter/search state + query + presenter +
  thumbnails + navigation.
- **No second `getProduct`.** If the parent already has `imageFileIds`,
  hydrate photos from that list. Do not start another `catalog.getProduct`
  for thumbnails.
- **Kebab-case files**, PascalCase component exports. Query/command
  binders use the feature-card names `product.queries.ts` /
  `product.commands.ts`; the list presenter is `products-list.presenter.ts`.
- **Catalog limits** come from `@showzy/validation/catalog` (or
  `ContractClient` types), not a second local number. List search uses
  `LIST_PRODUCTS_QUERY_MAX_LENGTH`. Photos uses `SET_PRODUCT_IMAGES_MAX`.
  Thumbnail URLs go through `src/api/file-download-query.ts`.
- **Screens do not own transport.** Routes re-export a screen. Screens
  compose a hook + view. Hooks call `api/` binders. Never import
  `@showzy/core`.
