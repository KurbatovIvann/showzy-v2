# Catalog products — golden mobile slice

Copy this tree for the next staff module. `src/app/` stays one-line
re-exports. Feature code lives here, not under
`src/components/screens/<feature>/`.

UI state ownership is `.cursor/rules/mobile-ui-state.mdc`. The form uses
RHF for create/edit fields and the variant sheet (SHO-159); bind scalar
fields through `Controller` (SHO-163). Pin exact `react-hook-form` /
`@hookform/resolvers` in `apps/mobile/package.json`. Photos is a
`useReducer` session (`reducePhotoSession`, SHO-162) — not XState.

## Folders (one role each)

| Folder    | Owns                                                                                             | Does not own                                                             |
| --------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `api/`    | `product.queries.ts`, mutation binders, `product-cache.ts` invalidation keys                     | JSX, RHF, session reducers                                               |
| `list/`   | Screen, view, composer hook, presenter, row, `use-product-thumbnails.ts`                         | Writes, photo session                                                    |
| `detail/` | Screen, view, facade, query/actions/variant hooks, sheet reducer                                 | Form field state, photo session internals                                |
| `form/`   | Create/edit screen, view, UI draft Zod, RHF composer, save loop, unsaved guard, variant sheet    | List filters; photo session internals                                    |
| `photos/` | `useReducer` session, thin manager hook, commit/runtime I/O, upload runner, native, picker       | A second `catalog.getProduct` when the parent already has `imageFileIds` |
| `shared/` | Permissions, presenters (`variant-count`), hrefs/ids, sheet chrome used by more than one surface | Transport                                                                |

## Copy-me rules

- **Query vs RHF vs `useReducer` vs view.** TanStack Query stays in
  `api/` and surface hooks. Form fields belong in RHF `Controller` (or
  section components that take `control`) — not the detail/list hooks
  and not a parallel `useState` per field. Photo session belongs in
  `useReducer` + `reducePhotoSession`. `use-product-photos.ts` composes
  the session with Query (download URLs) and the commit/runtime drivers
  — it does not own slots or the handshake. List filters and sheet
  chrome are `useReducer` (or local view state), never XState. Views
  take a view-model and callbacks. `use-products-list.ts` stays a thin
  composer: filter/search state + query + presenter + thumbnails +
  navigation. `use-product-detail.ts` stays a thin facade:
  `useProductDetailQuery` (`catalog.getProduct` only) + product actions +
  variant actions + photo manager + `product-detail.reducer.ts`. Pass
  `imageFileIds` from the detail query into photos; do not start a second
  `getProduct`. No RHF on detail.
- **No second `getProduct`.** If the parent already has `imageFileIds`,
  hydrate photos from that list. Do not start another `catalog.getProduct`
  for thumbnails.
- **Kebab-case files**, PascalCase component exports. Query binders live
  in `product.queries.ts` and `product-detail-query.ts`. Writes go through
  the real mutation binders — `product-form-mutation.ts`
  (`createProduct` / `updateProduct` / `createVariant` / `updateVariant`),
  `product-photos-mutation.ts` (`setProductImages`), `product-archive.ts`
  — not a fictional `product.commands.ts`. The list presenter is
  `products-list.presenter.ts`. Ids, hrefs, shared caps, and permissions
  live in `shared/`; `form/` must not import `detail/` except the shared
  variant sheet.
- **Catalog limits** come from `@showzy/validation/catalog` (or
  `ContractClient` types), not a second local number. List search uses
  `LIST_PRODUCTS_QUERY_MAX_LENGTH`. Photos uses `SET_PRODUCT_IMAGES_MAX`.
  Thumbnail URLs go through `src/api/file-download-query.ts`.
- **Screens do not own transport.** Routes re-export a screen. Screens
  compose a hook + view. Hooks call `api/` binders. Never import
  `@showzy/core`.
