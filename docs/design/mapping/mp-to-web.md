# Magic Patterns → web panel port map

> Authority: [ADR-0024](../../adr/0024-magic-patterns-canonical-ux.md),
> [ADR-0030](../../adr/0030-web-panel-spa-and-deferred-storefront.md).
> Canvas: [Shozee V2 — Web panel](https://www.magicpatterns.com/c/fdsqxjz1djvww5spay7zey).
> Chrome lock: [`web-panel-chrome.md`](web-panel-chrome.md).

The web canvas is the approved visual spec for `apps/web`. Tokens and
three-pane chrome live in `apps/web/src/theme/` and
`apps/web/src/components/ui/`. Never paste prototype React/Tailwind into
the SPA. Do not bind or maintain a Magic Patterns design-system preset
(ADR-0024). The custom **Showzy** DS in Magic Patterns is inactive on
purpose.

Figma is not a source of spacing or color. V1 is read-only domain
reference.

## Screen workflow (mandatory)

When work starts on a web product screen, do this **before writing
screen JSX**:

1. Resolve the canvas with Magic Patterns MCP:
   `get_editor_id_from_url` → `get_design_status` → read
   `canvas.manifest.js`.
2. Find the **Screens** entry for this surface (name + `state.screen`).
   The Screens tab is the inventory; `PrototypeSwitcher` labels match
   those ids. Read the component files that render that state (page +
   what it imports — list, detail, create, picker).
3. Classify each visual piece **shared** vs **feature**
   (`components/ui/` vs `features/<area>/`). Reuse or extend shared
   primitives; do not fork a second Button, StatusPill, PaneHeader, or
   DetailStage.
4. Port **intent**: hierarchy, layout, spacing rhythm, empty/loading,
   overlays. Snap values to existing tokens. Replace mock data with
   `@showzy/contract`.
5. If the screen is **not** in `canvas.manifest.js`, **stop**. Design it
   on the canvas (new ScreenId + `state`) before implementing. Do not
   invent a page from `web-panel-chrome.md` prose alone.

`web-panel-chrome.md` locks breakpoints, nav IA, status tones, and
tokens. It is not a substitute for reading the screen files.

If Magic Patterns MCP is unavailable (auth, cloud child, credits),
**stop and report**. Do not guess the layout.

## Discard (never port)

- Vite scaffolding, `package.json`, Tailwind as a second runtime
- `canvas.manifest.js`, `useScreenInit.js`, `data-id` props
- `PrototypeSwitcher` (canvas-only navigation)
- `react-router-dom` → TanStack Router
- mock `data/*.ts` → contract queries/mutations
- Google / guest auth (ADR-0006)

## Canvas

Editor: `https://www.magicpatterns.com/c/fdsqxjz1djvww5spay7zey`

Screen id → files: [`web-panel-chrome.md`](web-panel-chrome.md) §Screens
inventory.
