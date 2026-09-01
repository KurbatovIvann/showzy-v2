# Web panel architecture (`apps/web`)

> Decision record: [ADR-0030](../adr/0030-web-panel-spa-and-deferred-storefront.md).
> UX source of truth: the web canvas (ADR-0024) and
> [`mapping/web-panel-chrome.md`](mapping/web-panel-chrome.md). Agent
> rules: [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) and
> `.cursor/skills/showzy-web/SKILL.md`. This document is the directory /
> data-flow contract for SHO-325; it is not a product-behavior gate.

## Scope

`apps/web` is the **staff panel only**. The public storefront / consumer
surface is a separate later app (ADR-0030). The one public route in this
app is the document share landing `/d/$token` (not yet in the route
tree — add it when that feature ships).

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Build | Vite + React, TypeScript strict | Base tsconfig from `@showzy/tooling` |
| Routing | TanStack Router (file-based) | Typed params + search params; `useBlocker` for dirty-form guards |
| Server state | TanStack Query v5 | Same conventions as `apps/mobile` |
| Forms | react-hook-form + Zod v4 resolvers | Approved in ADR-0030; install when the first product form needs it. Onboarding currently uses a local planner. |
| Styling | Tailwind CSS v4 | Canvas tokens are the theme source (see below) |
| Primitives | Selectively vendored shadcn/ui (Radix) | Only behavior-heavy: Dialog, DropdownMenu, Select, Popover, Tabs, Tooltip, Toast |
| Icons | lucide-react | Matches the canvas |
| Auth | better-auth React client | Phone/email OTP only (ADR-0006); browser cookie session |

No global state store. See [State ownership](#state-ownership).

### Theme

Magic Patterns tokens (`canvas`, `surface`, `ink`, `muted`, `faint`,
`line`, `action`, `focus`, `danger`, soft variants) are the single theme
source, declared as CSS variables and mapped onto shadcn's semantic
slots (`canvas → background`, `surface → card`/`popover`,
`ink → foreground`, `line → border`, `ink → primary`, `action → ring`,
`danger → destructive`). Vendored shadcn components are reskinned to
canvas classes on arrival; simple visual components (buttons, status
pills, nav rows, cards, form wrappers) are ported from the canvas markup
directly, without shadcn. Components are added one by one, on demand —
never the full kit.

## Communication with the API

The only data path is the typed oRPC client:

- `createContractClient` from `@showzy/contract` via
  `apps/web/src/api/client.ts` → `/rpc`. No hand-written fetch for
  domain data. `@showzy/contract/server` is forbidden in the bundle
  (`clientApp` ESLint boundary).
- **Tenant scope**: the active company comes from the URL slug,
  resolved against `companies.listMine`; the client then sets the
  `x-company-id` header via `setActiveCompany`. The slug/header is a
  selector — the server verifies membership (ADR-0013).
- **Queries**: key shape `[actionName, companyScope, input]` from
  `contractQueryKey` / `contractQueryOptions`. Account reads use
  `accountContractQueryKey` (`null-company` + session user id). Pass
  live `useActiveCompany().activeCompanyId` into options so a
  selector change re-renders keys. Loaders must reuse these options
  (`ensureQueryData`) — one cache.
- **Mutations**: one `createMutationAttempt()` per logical submit
  (`useContractMutation`); retry reuses `attempt.options`. A new
  submit mints a new key (contract.md §3).
- **Confirmation**: `CONFIRMATION_REQUIRED` is handled with
  `attempt.withChallenge(challengeId)` on the **same** attempt. The
  challenge is meta, never action input.
- **Errors**: discriminate on wire `error.code` via `isWireError` /
  `describeQueryFailure` / `describeWireCode`, never on message text.
- **Invalidation**: `invalidateQueries` / `setQueryData` only the
  keys the write changed (see `applyCreatedCompany`).
- **Money**: `moneyToWire` / `moneyFromWire` only.
- **Views** receive data and callbacks. They do not own contract
  calls. Feature `api/` adapters expose typed query/mutation options.

### Deployment topology

Static files behind a reverse proxy that also forwards `/rpc` and
`/api/auth` to the API — same-origin, so CORS never activates and
`SameSite=Lax` session cookies work unchanged. Dev uses the Vite proxy.
API-side prerequisite: the web origin joins better-auth `trustedOrigins`.

Concretely (web-T2):

- **Prod/staging**: `apps/web/deploy/compose.yml` (Coolify) builds
  `apps/web/Dockerfile` — Caddy serves the SPA bundle (unknown paths fall
  back to `index.html`) and proxies `/rpc` + `/api/auth` to `API_UPSTREAM`
  (the API service on the same deployment network). TLS terminates at the
  platform ingress. No CORS headers anywhere — adding CORS instead of this
  proxy is a stop-condition (ADR-0030).
- **Dev**: the Vite proxy in `apps/web/vite.config.ts` mirrors the same
  rules against the local API.
- **API side**: the panel origin(s) come from validated env —
  `WEB_APP_ORIGINS` (comma-separated, `packages/config`) — and join
  better-auth `trustedOrigins` in `apps/api/src/auth/options.ts`. Origin
  checks only; never an access grant.
- **Client IP across two proxies**: requests cross ingress (Traefik, TLS
  termination) → Caddy → API. Caddy trusts the ingress via
  `trusted_proxies` in the Caddyfile (so it forwards the ingress-provided
  `X-Forwarded-For`/`-Proto` instead of overwriting them), and the API's
  `TRUSTED_PROXIES` must include the web/Caddy hop address (or the Coolify
  overlay network CIDR) so Hono accepts the forwarded chain
  (`docs/specs/security-operations.md` §2). Either hop alone still loses
  the client IP, collapsing per-client rate limits (e.g. OTP send) into
  one shared proxy-IP bucket.

## URL map

The three-pane chrome maps onto nested routes: the list route renders
the list pane and an `Outlet` for the detail pane; child routes fill
the detail pane. Below the `md` breakpoint the route depth decides the
visible pane (index route → list, child route → detail; back returns
to the list). Dirty-form guards use the router blocker with the
LeaveDialog from the canvas.

```
/sign-in                     auth: phone/email OTP entry
/verify                      auth: OTP code
/d/$token                    public share landing (no session)
/                            redirect → last company (prefs) or company picker

/$companySlug                layout: resolve slug via companies.listMine,
│                            set x-company-id, guard session
├─ orders                    list        ── $orderId │ new
├─ documents                 list (tab: issued)
│  ├─ $documentId            detail; ?share / ?sign drive the dialogs
│  ├─ new                    create-from-order; ?orderId= preset
│  └─ templates              list (tab: templates)
│     ├─ $templateId         detail
│     └─ $templateId/edit    full-shell takeover (template editor, T6)
├─ products                  list        ── $productId │ new │ $productId/edit
├─ customers                 list (tab: clients) ── $customerId │ new
│  ├─ groups                 tab         ── $groupId │ new
│  └─ counterparties         tab         ── $counterpartyId │ new
├─ invites                   list        ── $inviteId │ new
├─ pricing                   list        ── $priceListId │ new │ $priceListId/edit
└─ company                   list pane: Профіль / Реквізити / Команда
   ├─ legal
   └─ team
```

Conventions:

- **Search params are typed and validated** by the router: list search
  text, status/type filter chips, and dialog state (`?share=1`,
  `?sign=confirm`) — so every screen state is linkable and survives
  reload.
- **Tabs are routes** (documents/templates, customers/groups/
  counterparties), matching the chrome lock's list-pane tabs.
- **Full-shell takeovers** (template editor; future onboarding wizards)
  are ordinary routes that render outside the panel layout via a
  pathless `_full` group.
- The AI dock («Шозік») is a layout-level overlay, not a route.

## Directory route tree

### Current (`main`, as of SHO-327)

Do **not** restructure this tree in a documentation ticket. Company-scoped
routes live in URL-segment folders under pathless `_panel` (chrome) and
`_full` (template editor). Folder-local `route.tsx` owns the layout and
must render `<Outlet />`; the exact URL is `index.tsx`. Panel chrome
still lives in `src/features/panel` until the layouts move ticket.
Composition files live at `src/main.tsx`, `src/router.tsx`,
`src/app-providers.tsx`. Panel section, list vs detail, tabs, and back
targets are derived from typed route matches and `staticData.panel`
(SHO-328). The company home (`/$companySlug`) is `_panel/index.tsx` so it
receives panel chrome without a URL segment.

```
apps/web/src/routes/
  __root.tsx
  _auth.tsx                         # pathless auth layout (file)
  _auth/sign-in.tsx
  _auth/verify.tsx
  _authed.tsx                       # pathless authed layout
  _authed/index.tsx                 # /
  _authed/onboarding.tsx           # account-scoped, not company-scoped
  _authed/$companySlug/
    route.tsx                     # resolve slug, set x-company-id
    _panel/
      route.tsx                   # pathless: panel chrome
      index.tsx                 # /$companySlug home (orders chrome)
      orders/
        route.tsx
        index.tsx
        $orderId.tsx
        new.tsx
      documents/
        route.tsx
        index.tsx
        $documentId.tsx
        new.tsx
        templates/
          route.tsx
          index.tsx
          $templateId.tsx
      products/
        route.tsx
        index.tsx
        new.tsx
        $productId/
          route.tsx
          index.tsx
          edit.tsx
      customers/
        route.tsx
        index.tsx
        $customerId.tsx
        new.tsx
        groups/
          route.tsx
          index.tsx
          $groupId.tsx
          new.tsx
        counterparties/
          route.tsx
          index.tsx
          $counterpartyId.tsx
          new.tsx
      invites/
        route.tsx
        index.tsx
        $inviteId.tsx
        new.tsx
      pricing/
        route.tsx
        index.tsx
        new.tsx
        $priceListId/
          route.tsx
          index.tsx
          edit.tsx
      company/
        route.tsx
        index.tsx
        legal.tsx
        team.tsx
    _full/
      route.tsx                   # pathless: no panel chrome
      documents/templates/$templateId/edit.tsx
```

`src/routeTree.gen.ts` is generated by `@tanstack/router-plugin` in
`vite.config.ts`. Never hand-edit it. ESLint ignores it.

### Intended (SHO-327+, placement for new/moved files)

Company-scoped URLs stay under `$companySlug`. Pathless `_panel` and
`_full` groups keep those URLs unchanged while making chrome ownership
explicit. Folder-local `route.tsx` is the layout (must render
`<Outlet />`). The exact URL of a parent is `index.tsx`.

```
apps/web/src/routes/
  __root.tsx
  _auth/
    route.tsx                       # pathless: session gate + OtpProvider
    sign-in.tsx
    verify.tsx
  _authed/
    route.tsx                       # pathless: session required
    index.tsx                       # /
    onboarding.tsx
    $companySlug/
      route.tsx                     # resolve slug, set x-company-id
      _panel/
        route.tsx                   # pathless: panel chrome layout
        index.tsx                   # /$companySlug home (orders chrome)
        orders/
          route.tsx                 # list pane + <Outlet />
          index.tsx                 # exact /$companySlug/orders
          $orderId.tsx             # leaf detail (promote to folder when children exist)
          new.tsx
        documents/
          route.tsx
          index.tsx
          $documentId.tsx
          new.tsx
          templates/
            route.tsx
            index.tsx
            $templateId.tsx
        products/
          route.tsx
          index.tsx
          new.tsx
          $productId/
            route.tsx              # only because edit is a child
            index.tsx
            edit.tsx               # still panel, not full-shell
        customers/
          route.tsx
          index.tsx
          $customerId.tsx
          new.tsx
          groups/
            route.tsx
            index.tsx
            $groupId.tsx
            new.tsx
          counterparties/
            route.tsx
            index.tsx
            $counterpartyId.tsx
            new.tsx
        invites/ …                 # same list/index/detail/new shape
        pricing/ …
        company/
          route.tsx
          index.tsx
          legal.tsx
          team.tsx
      _full/
        route.tsx                   # pathless: no panel chrome
        documents/
          templates/
            $templateId/
              edit.tsx              # /$companySlug/documents/templates/$id/edit
```

Create a `$id/` folder with `route.tsx` **only** when that resource has
child routes. A leaf stays `$id.tsx`. Do not mkdir the whole diagram
up front.

## Canonical source ownership

```
apps/web/src/
  app/
    main.tsx
    router.tsx
    providers.tsx
    runtime.ts                     # wires existing lifecycle; not a store
  routes/
  api/
  auth/
  layouts/
    panel/
      panel-layout.tsx
      navigation/
      responsive/
  features/
    auth/
    companies/
    <domain>/
      api/
      list/
      detail/
      form/
      shared/
      testing/
  components/ui/
  i18n/
  prefs/
  theme/                           # CSS variables (exists today)
  test/
    integration/
    fixtures/
    support/
```

| Path | Responsibility |
| --- | --- |
| `app/` | Composition root. `runtime.ts` composes existing services (`bindActiveCompanyRuntime`, auth client). It must not become a global store. |
| `routes/` | Thin adapters. Validate, prefetch, render. |
| `layouts/` | Reusable cross-feature shells. **Panel is a layout, not a product feature.** `features/panel` is transitional and must not remain after the move ticket. |
| `features/` | User-facing capabilities. Auth **screens** → `features/auth`. Better Auth / session → `auth/`. |
| `api/` | Shared oRPC + Query helpers. Feature adapters live in `features/<area>/api/`. |
| `components/ui/` | Domain-neutral primitives only. Panel-specific CSS/components belong under `layouts/panel`. |
| `auth/`, `prefs/`, `theme/` | Session/OTP; device prefs; canvas tokens. |
| `test/` | Shared support (`msw`, `renderApp`) and cross-feature integration. Feature tests colocate. |

Import direction is in `apps/web/AGENTS.md`. Same convention: views do
not import the contract client; `components/ui` does not import
features.

## State ownership

Four owners. No fifth store without a new ADR.

| Owner | Holds |
| --- | --- |
| Router URL / search | Navigation, selected record, tabs, filters, linkable dialogs |
| TanStack Query | Server data. Company-scoped keys. Not persisted. |
| React Hook Form | Form fields. Zod from `@showzy/contract` / `@showzy/validation`. |
| Local state / reducer | Ephemeral UI (OTP, drawers). Pure reducers live in `.ts` files. |

Do not copy server rows into a module-level store. Do not reconstruct
the route hierarchy from `location.pathname`.

## Extraction

Keep code feature-local until a **third** real repetition. No universal
form, page, repository, or view-model framework. Do not pre-port
mobile `form-kit` into web.

## Agent rules (must agree with `apps/web/AGENTS.md`)

- Thin route adapter: validate params/search, optionally prefetch,
  render a feature page.
- Cross-feature chrome → `layouts/`; product capabilities → `features/`;
  app assembly → `app/`.
- Parent route with children renders `<Outlet />`; exact route is
  `index.tsx`.
- No pathname prefix parsing/regex to reconstruct route hierarchy.
- No direct `fetch`, DB/module import, contract/server import, or
  server-state copy in a local/global store.
- Query keys always contain action name, company/account scope, and
  semantic input.
- One idempotency attempt per logical mutation submit; retry reuses
  it.
- Views receive data/actions and do not own contract calls.
- Test public behavior; mock `/rpc` or a feature API boundary, never
  internal implementation modules.
- Never hand-edit `src/routeTree.gen.ts`.
- Do not create empty folders or abstractions for hypothetical reuse.

## Examples (existing primitives)

These are conceptual. Do not add empty `features/orders/` to make them
compile. Copy `features/companies/` and `src/api/`.

### List page

```tsx
// features/orders/api/list.ts — copy list-mine.ts
export function ordersListQueryOptions(args: {
  readonly actionName: "orders.list";
  readonly companyId: string;
  readonly input: { readonly q: string };
  readonly queryFn: () => Promise<OrdersListOutput>;
  readonly getActiveCompany: () => string | null;
}) {
  return contractQueryOptions(args);
}

// routes/_authed/$companySlug/_panel/orders/route.tsx
function OrdersLayout() {
  return (
    <OrdersListPane>
      <Outlet />
    </OrdersListPane>
  );
}

// routes/_authed/$companySlug/_panel/orders/index.tsx
function OrdersIndex() {
  return <OrdersEmptyDetail />;
}
```

The list hook uses `useActiveCompany().activeCompanyId` and
`useApiClient()`. The view receives rows and `onOpen(orderId)`.

### Detail route

```tsx
// routes/_authed/$companySlug/_panel/orders/$orderId.tsx
export const Route = createFileRoute(
  "/_authed/$companySlug/_panel/orders/$orderId",
)({
  validateSearch: (search) => search,
  loader: ({ context, params }) => {
    /* ensureQueryData(same get-options as the page hook) */
  },
  component: function OrderDetailRoute() {
    const { orderId } = Route.useParams();
    return <OrderDetailPage orderId={orderId} />;
  },
});
```

Back navigation uses the typed list route, not a pathname prefix.

### Form mutation

```ts
const mutation = useContractMutation((input, options) =>
  bindCreateCompanyMutate(client)(input, options),
);
const plan = planCreateCompanySubmit({ name, slug, lastSubmitted, lastFailureKind });
if (plan.kind === "retry") await mutation.retry();
else if (plan.kind === "submit") await mutation.submit(plan.input);
// CONFIRMATION_REQUIRED → same attempt.withChallenge(id)
```

Copy `create-company-mutation.ts` + `create-company-form.ts`. Map
`describeQueryFailure` kinds; never `error.message`.

### Route integration test

```tsx
import { renderApp } from "../test/render";
import { sessionState } from "../test/msw";

it("opens a company-scoped list from the URL", async () => {
  sessionState.user = { id: "user-1", email: "a@b.c", phoneNumber: null };
  const { router } = await renderApp("/kviti-lviv/orders");
  expect(router.state.location.pathname).toBe("/kviti-lviv/orders");
});
```

MSW intercepts `/rpc`. Do not reconstruct the route hierarchy from
`location.pathname`.

## Testing

- Vitest + Testing Library (jsdom) for components/hooks; the `/rpc`
  boundary is mocked (msw), never module internals.
- Playwright smoke joins CI with the web phase (blueprint test row).
- Standard definition-of-done rules apply per feature card.

## Stop-conditions

- Any new backend action, event, table, principal, or authorization
  rule.
- Any URL or product UX change beyond preserving/fixing the approved
  panel behavior.
- Introducing Zustand/XState/global server-state duplication.
- Replacing oRPC/TanStack Query or adding handwritten REST/fetch
  clients.
- Building a universal form, page, repository, or view-model
  framework.
- Editing generated route files manually.
- Auth, cookie, proxy, or CORS changes.
- Empty ceremonial directories created only to match this diagram.
- Production routing/data behavior change in a documentation ticket.
