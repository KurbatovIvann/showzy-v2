# Showzy 2.0 — Architecture Blueprint

> Final document: architecture, technology stack, and the SDD agent pipeline.
> Status: approved. Date: August 2026.
> Sources: audit of the current system (apps/api ~36k lines, apps/web ~119k,
> apps/mobile ~58k, 77+ tables, 83 migrations, ~240 RLS policies).

---

## 1. Product

Showzy is a business operating platform for small businesses in Ukraine — not
a multi-seller marketplace or social hub, but it includes an authenticated
consumer discovery surface (ADR-0018). It replaces the zoo of services a
micro-business juggles (Instagram + Telegram + spreadsheets + Taxer) with a
single app. The reference user is a home confectionery.

- **Company profile** with a catalog and flexible pricing (5 levels: personal price → client price list → group price list → default price list → base price). Validated on a real case: separate prices for coffee shops, regular customers, and loyal customers.
- **Canonical flow**: customer → company profile → cart → checkout (account required) → **redirect to chat** with an order card. The company confirms/edits/cancels the order in chat. **Chat is the operational core of the product.**
- **B2B add-on**: a customer with a legal profile (sole proprietor / legal entity) gets document workflow — contracts, invoices, delivery notes, **QES signing** (DSTU, ASiC-E) — the private key never leaves the device. Same flow, extra actions.
- **Two management surfaces**: company panel and customer cabinet.
- **Integrations**: Nova Poshta (V2 launch); Monobank acquiring + bank statements as the foundation of accounting (post-launch), Resend, SMS.
- **AI assistant** with tool calling — at parity with the UI.
- **Client strategy: mobile-first for all functionality** (panel and cabinet). Web is a post-launch phase, with universal links.

Full scope analysis (what we carry over / simplify / drop) and the roadmap:
`docs/scope.md`.

### Rewrite goal

**AI-first interface**: two parallel interfaces — a classic UI and an AI chat —
that perform **the same actions**. The AI can show data in chat, open modals,
fill forms, execute operations. Development follows SDD: 90–100% of the code is
written by AI agents.

### Main problems of the current system (from the audit)

1. **Two data paths**: clients hit Supabase directly (CRUD via PostgREST + ~240 RLS policies + 79 RPCs) and NestJS in parallel (chat, documents, payments, AI). Logic is smeared across RLS, triggers, RPCs, and the API.
2. **No shared contract**: DTOs are hand-duplicated in web and mobile (`documents-api.ts` vs `get-panel-documents.ts`).
3. **Vendor lock-in on Supabase** (Auth, Storage, PostgREST, typegen).
4. **The AI assistant is ad-hoc**: its own tool set, disconnected from UI actions.

---

## 2. Architectural principles

1. **One data path.** All business logic goes through the API only. Clients never touch the DB directly. RLS disappears; authorization lives in code.
2. **The action registry is the single source of truth.** Every business operation is described once (`defineAction`), and from it we generate: the oRPC procedure, the AI tool, the form schema, the permission check, the audit log.
3. **Interface parity is guaranteed physically**: the classic UI and the AI call the same handler.
4. **Explicit code, no magic.** No decorators with hidden behavior, no DI containers, no "default" conventions. An agent must see the whole flow in the code.
5. **Static guarantees above all.** TypeScript strict end-to-end: DB schema → types → API contract → clients → AI tools. An agent's mistake = red CI, not a bug report.
6. **Human-in-the-loop for the irreversible.** QES signing, payments, deletions — the AI prepares, a human confirms.
7. **Modular monolith.** Clear module boundaries (ESLint boundaries), shared DB, one deployment. Microservices — no.

### 2.1 Foundation invariants (part of phase 0 definition of done)

These are not "best practices for later" — they are entry criteria verified by
tests before any domain module is built:

1. **Tenant isolation.** It must be impossible for a business action to read or write another company's data. Tenant scope is derived by core from verified staff membership, a typed customer/public target resolver, explicit system scope, or null company for `consumer` global discovery (ADR-0013, ADR-0018) — never accepted from input as an access grant. Verified by an automated cross-tenant test suite that every module inherits. This is what replaces the deleted ~240 RLS policies: code + tests instead of DB policies.
2. **Idempotency.** Order creation, payments, document generation, Nova Poshta calls, webhooks, and AI-invoked actions are safely retryable (idempotency keys where needed). Retries come from everywhere: workers, webhook redelivery, the AI loop.
3. **Money model: immutable snapshots.** An order item stores `unitPriceSnapshot`, `quantity`, `discountSnapshot`, `taxSnapshot`, `total` captured at creation time. An old order is never recomputed from current pricing. Critical given 5-level dynamic pricing and future accounting built on real transactions.
4. **Observability / audit.** Every authorized tenant-scoped action carries `request_id`, accountable `actor_id` (user or system), invocation `channel` (`ui`/`ai`/`system`/`webhook`), resolved `company_id`, and `action`; declared global system work has null company. Unauthenticated public reads use synthetic log actor `anonymous` and cannot emit domain events or durable audit rows. `audit: true` actions write an audit record. AI is a channel acting on behalf of a user, not an independently accountable principal. Non-negotiable because actions will be invoked by AI.
5. **Projections never own domain state.** Chat is the primary interaction surface for orders, but the order domain is the source of truth: an order card in chat is a projection updated by domain events (`orders.confirm` → `orders.confirmed` → card update). A chat message stores `orderId`, never order status. `orders` does not know chat exists — it emits events; `chat` subscribes and materializes cards. The same rule applies to every future projection (dashboards, notifications, analytics).

---

## 3. Technology stack (final)

| Layer | Technology | Rationale |
| --- | --- | --- |
| Runtime | **Node.js 22 LTS + TypeScript (strict)** | The whole ecosystem (UAPKI WASM, Puppeteer, Socket.IO) is proven on Node |
| Monorepo | **Turborepo + pnpm** | Already works; shared packages are critical for agents |
| HTTP framework | **Hono** (`@hono/node-server`) | Minimal, fetch-native, explicit. SSE, raw body, streaming proxy — out of the box. Heavy stuff (Puppeteer, WASM, queues) lives outside the framework |
| API contract | **oRPC** | End-to-end types for web/mobile + OpenAPI autogeneration. Kills the hand-written DTO duplicates |
| Database | **PostgreSQL 17** (self-hosted) | Extensions: pg_trgm + unaccent. Scheduled work moves to BullMQ, so pg_cron is dropped with v1 invite/analytics jobs; pgvector/pg_partman return only if their dropped features return |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Schema in TypeScript = source of types; SQL-like API without magic; versioned migrations |
| Auth | **better-auth** | Self-hosted TS library: email/phone OTP, sessions, native Drizzle integration |
| Storage | **S3-compatible** (MinIO locally → Cloudflare R2 in prod) | Replaces Supabase Storage; signed URLs work the same |
| Queues | **BullMQ + Redis** | Decision revised after the audit: Redis is mandatory anyway (Socket.IO adapter, cache, leader election), and patterns for 7 queues are already established |
| Realtime | **Socket.IO + Redis adapter** | Carried over from the current system almost unchanged |
| Reliable events | **Transactional outbox** (`domain_events` + `FOR UPDATE SKIP LOCKED` + LISTEN/NOTIFY) | Already implemented correctly — carried over |
| Validation | **Zod v4** | One schema: form → API → AI tool → DB boundary |
| AI | **Vercel AI SDK v6** | Tool calling, streaming, generative UI; provider-agnostic (Anthropic/OpenAI) |
| Mobile | **Expo + expo-router + Unistyles** — **primary client** | Mobile-first: all V2 functionality (panel + customer cabinet + AI chat) in the app |
| Web | **Next.js (App Router)** — post-launch phase | Storefront by link (SEO), cabinet in the browser, desktop template editor; universal links into the app |
| Web UI | **shadcn/ui + Tailwind 4 + react-hook-form** | Carried over (in the web phase) |
| QES | **`@showzy/document-signing`** (UAPKI: WASM web/node, Nitro native) | The verified crypto core carries over unchanged (bindings, ASiC-E, tests, signing vectors); the integration surface (storage, auth context, module wiring) is re-audited against the new architecture |
| PDF | **Puppeteer** + React SSR of Plate documents | Carried over |
| Logs / tracing | **pino + OpenTelemetry + Sentry** | Structured logs with request-id from day one |
| Tests | **Vitest** (unit/integration) + **Testcontainers** (Postgres in tests) + **Maestro** (mobile e2e) + Playwright (web phase) | Agents must have a fast local feedback loop |
| Deployment | **Docker Compose** locally → VPS (Coolify) | No vendor lock-in; horizontal API scaling + separate workers |

### What we deliberately do NOT take

- **Supabase** — decomposed (Postgres + better-auth + S3 + Socket.IO + app-level permissions).
- **NestJS** — decorators/DI hide the flow from agents; all the value (guards, pipes) is reproduced by the action registry in ~10× less code.
- **Encore** — framework-shaped vendor; our workload (Socket.IO, Puppeteer, WASM) does not fit its managed-primitives model. But its lesson is taken: durability decisions are fixed by the architecture, not by the agent.
- **tRPC** — oRPC gives the same + OpenAPI for external consumers.
- **RLS** — authorization only in code (`defineAction.permissions`); the `has_company_permission` model is carried over conceptually 1:1.
- **Microservices, GraphQL, event sourcing** — needless complexity for a team of agents.

---

## 4. The core: action registry

```ts
// packages/modules/orders/actions/create.contract.ts — client-safe
export const createOrderContract = defineActionContract({
  name: "orders.create",
  description: "Create an order for a company customer", // ← goes into the AI tool
  input: z.object({
    // companyId is NOT here — it is injected by ctx from the authenticated
    // membership (tenant isolation invariant, §2.1)
    customerId: z.string().uuid(),
    items: z.array(orderItemSchema).min(1),
  }),
  output: orderSchema,
  principal: "staff",              // staff | customer | public | system | consumer | account (ADR-0013, ADR-0018)
  transport: "client",             // client route | internal-only capability
  permissions: ["orders:create"],  // checked before the handler

  // AI & execution metadata — designed in at phase 0, consumed from phase 9
  aiExposure: "exposed",           // exposed | internal (never becomes an AI tool)
  risk: "write",                   // read | draft | write | high
  requiresConfirmation: false,     // high-risk: UI renders a human confirmation step
  idempotent: true,                // safe to retry (workers, webhooks, AI loop)
  emits: ["orders.created"],       // declared outbox events; CI checks vs ctx.emit
  timeout: 5_000,
  audit: true,                     // written to the audit log
});

// packages/modules/orders/actions/create.ts — server-only
export const createOrder = implementAction(createOrderContract, {
  handler: async (input, ctx) => {
    // ctx shape depends on the declared principal mode (ADR-0013);
    // for staff: { db, userId, companyId, membership, emit, call }
    // one transaction; ctx.emit puts the event into the outbox in the same
    // transaction; ctx.call invokes another module's read action (ADR-0015)
  },
});
```

From one logical definition (one client-safe descriptor paired with one
server implementation; ADR-0008, ADR-0016, and contract.md) we
generate:

1. **oRPC procedure** → typed client for web/mobile + OpenAPI spec.
2. **AI tool** → `name`/`description`/`input` become the tool definition; the handler is the same.
3. **Form schema** → the same Zod schema in react-hook-form.
4. **Permissions + audit** → in one place, regardless of who called.

The AI metadata is part of the definition from phase 0 precisely so that
phase 9 becomes "connect the LLM to the existing capability graph" rather than
"rewrite half the backend for AI". Examples of the gradient:
`orders.get` → `risk: read`, no confirmation · `documents.createDraft` →
`risk: draft`, no confirmation · `documents.sign` → `risk: high`,
`requiresConfirmation: true`, the final step is human-only (QES key never
leaves the device).

### Client-side AI UI tools (executed on the client, not the server)

- `ui.navigate(route)` — go to a page
- `ui.openModal(modal, props)` — open a modal/form
- `ui.prefillForm(formId, values)` — fill a form (the user sees and confirms)
- `ui.highlight(elementId)` — highlight an element
- Generative UI: tool results render with the same components as the classic UI (order card, product list, document).

### Human-in-the-loop

QES signing, payment execution, irreversible deletions: the AI calls a
preparatory action → the UI shows a confirmation → the user performs the final
step. The QES private key is physically inaccessible to the server and the AI.

---

## 5. Monorepo structure

```
showzy/
├─ apps/
│  ├─ api/            # Hono: mounts the oRPC router + webhooks + SSE + Socket.IO
│  ├─ worker/         # BullMQ processors, outbox poller, cron (separate process)
│  ├─ mobile/         # Expo — primary client (V2 launch)
│  └─ web/            # Next.js — phase 10 (post-launch)
├─ packages/
│  ├─ core/           # defineAction, registry, context, event bus, outbox client
│  ├─ db/             # Drizzle schema (source of types), migrations, seed
│  ├─ contract/       # oRPC router generated from the action registry
│  ├─ modules/        # domain modules (see §6) — actions + services + events
│  ├─ ai/             # agent, system prompts, UI tools, generative component mappings
│  ├─ document-signing/  # UAPKI (crypto core carried over; integration re-audited)
│  ├─ validation/     # shared Zod schemas (carried over, extended)
│  ├─ ui/             # shared design tokens/types for web+mobile
│  ├─ config/         # validated runtime env (Zod-parsed process.env; no secrets in code)
│  └─ tooling/        # eslint presets (boundaries!), tsconfig, prettier
├─ docs/
│  ├─ blueprint.md              # this document
│  ├─ specs/          # module specifications — frozen contracts (one .md per module)
│  └─ plans/          # mutable task breakdowns (one .md per module; see pipeline.md)
└─ .cursor/
   ├─ rules/          # rules for agents (conventions, prohibitions, DoD)
   └─ commands/       # stage commands: /spec /plan /scaffold /implement /review /ticket /rework-spec
```

### Domain modules (packages/modules/*)

**V2 launch:** `companies` (company, team, RBAC, legal info, public profile, business categories, publication lifecycle) · `customers` (company CRM records, groups, customer legal profiles) · `catalog` (products, variants, categories) · `pricing` (price lists, personal prices; references customers/groups but does not own them) · `orders` (carts, order items/logs, fixed statuses) · `payments` (phase-0 provider abstraction, payment records/status; invoice/manual) · `chat` (conversations, messages, reactions — the operational core) · `documents` (CRUD, default templates, numbering) · `doc-generation` (Plate → HTML → PDF) · `doc-signing` (QES, ASiC-E, pki-proxy) · `delivery` (Nova Poshta + its reference data) · `reference-data` (KVED/CPV) · `notifications` (in-app, push, email, sms) · `invites` · `files` (attachment ownership: product images, chat attachments, document files; signed upload URLs, size/type policy) · `feature-flags` (phase-0 skeleton) · `search` (global FTS/trigram discovery projections for published companies and products — ADR-0018) · `analytics` (simple dashboard) · `assistant` (phase 9: AI conversation persistence — `packages/ai` is the engine and owns no tables)

**Post-launch:** `acquiring` (Monobank acquiring + fiscalization, plugs into `payments`) · `banking` (statements, matching, accounting foundation) · `subscriptions` (billing; consumes the existing feature-flag capability)

Exact table/capability ownership and sanctioned composition edges are tracked
in `docs/module-ownership.md`; module specs refine but may not silently move
these boundaries.

Boundary rule: a module's server barrel exports only actions/events and its
client-safe barrel only descriptors. Directly importing another module's
internal files is an ESLint error.

---

## 6. Key data migration decisions

| What | Decision |
| --- | --- |
| DB schema (77+ tables) | **Not** carried over 1:1. Every object appears in the v1→v2 migration matrix as keep/transform/drop and maps to one owning V2 module; text+CHECK is preferred over enums |
| ~240 RLS policies | Deleted. Logic → `permissions` on actions. The largest rethinking effort |
| ~79 RPC functions | Rewritten as ordinary module functions on Drizzle (transactions in code) |
| ~82 triggers | A conscious decision for each: technical ones (updated_at, counters) stay in the DB; business logic (numbering, auto-statuses) moves up into code |
| Outbox (`domain_events`) | Protocol carried over and hardened: SKIP LOCKED + LISTEN/NOTIFY dispatch, per-consumer delivery/dedup/retry state |
| Storage buckets | `documents-bucket`, `chat-attachments` → same S3 structure, paths in the DB |
| `database.types.ts` (typegen) | Disappears — types are born from the Drizzle schema |
| Auth users | Export from Supabase Auth → import into better-auth (phones/emails preserved) |

The object-level ledger and per-module completion gate live in
`docs/reference/v1-migration-matrix.md`. A domain schema task cannot start
while its source rows are `REVIEW` or lack the required column mapping.

---

## 7. SDD agent pipeline

### 7.1 Work phases

```
SPECIFICATION → PLAN → SCAFFOLD → IMPLEMENTATION → REVIEW → VERIFICATION
 (human+agent)  (agent)  (agent)   (agents in parallel)  (agents)   (CI)
```

1. **Specification.** For each module — a file `docs/specs/<module>.md`: purpose, actions (name/input/output/permissions), events, tables, edge cases, acceptance criteria. Written by an agent in Cursor Plan mode, approved by a human. The spec is a contract: the implementing agent may not change it, only send it back for rework.
2. **Plan.** The agent splits the spec into tasks of ≤ ~300 diff lines each, with explicit dependencies. One task = one branch = one PR.
3. **Scaffold.** The first versions of `packages/core`, `db`, `contract`, and **two reference slices** are written with maximum care: (a) pricing resolution for pure/query and `ctx.call` patterns; (b) a thin order → outbox → chat projection for write/idempotency/event patterns. Their prerequisite schema slices are specified and merged first. These are the templates agents copy. The lesson of the Encore benchmark: an agent on an empty minimal framework invents anti-patterns — so patterns are locked in before mass generation.
4. **Implementation.** Parallel agents (Cursor background/cloud agents) — one per task. Each receives: the module spec, its bounded context pack, and the relevant reference slice. TDD: tests from the spec first, then code.
5. **Review.** Every PR: (a) Bugbot, (b) a review agent from a different model family than the implementer, (c) for auth/payments/QES — an additional security review. A human fully reviews every foundation/sensitive PR; after the references stabilize, routine PR review focuses on contested spots.
6. **Verification (CI).** Merging is impossible without green: format + secret/dependency checks → `tsc --noEmit` → ESLint (boundaries, no `any`, no direct cross-module imports) → Vitest (unit + integration with Testcontainers Postgres) → action/event contract checks (mandatory metadata including `principal`/`transport`, pairing, resolver and event definitions) → migration drift/safety → e2e smoke, phase-aware: Maestro once mobile screens exist, Playwright only from the web phase.

### 7.2 Rules for agents (`.cursor/rules/`)

- **Code conventions**: action naming (`<module>.<verb>`), module structure, error style (typed, no bare `throw new Error`).
- **Prohibitions**: raw SQL outside approved Drizzle/foundation exceptions; DB access outside a handler/service/typed target resolver; `any`/`as unknown as`; new dependencies without approval; changing `packages/core` in module tasks.
- **Definition of Done**: tests for every action (happy + mode-appropriate authorization denial + validation/output failure + metadata-required protocols), spec ambiguities reported (never silently resolved — implementers cannot edit specs), green CI.
- **Context**: every package has an `AGENTS.md` with local instructions (as in the current repo).

### 7.3 Model selection (Cursor, August 2026 lineup)

Principles: (1) **different model families for writing and review** — one model's systematic blind spots are caught by another; (2) **expensive models front-loaded, cheap models at scale** — top-tier models build the foundation and reference slices (phases 0–1); once the templates exist, mass implementation shifts to a cheap fast model, because the pipeline (references + TDD + CI + review by a stronger model) is what guarantees quality, not the implementer's raw capability; (3) the Cursor model lineup changes monthly — the table below describes roles; substitute current equivalents.

| Pipeline role | Model | Why |
| --- | --- | --- |
| Architecture, specifications, migration plan | **Claude Opus 5 (thinking, high)**; cross-check critical docs with **GPT-5.6 Sol (high)** | Maximum reasoning depth; a mistake at this level is the most expensive. Rare invocations — cost is negligible |
| Foundation (phases 0–1): `packages/core`, `db`, `contract`, reference slices | **Claude Fable 5 (thinking)** — if its data-retention terms are accepted (Anthropic stores agent I/O for harm prevention); otherwise **Claude Opus 5 (thinking, high)** at half the token price | Code that becomes the template for everything else must be impeccable. Expensive, but bounded: used front-loaded, not permanently |
| Sensitive surfaces at any phase: auth, payments, QES, webhooks, file authorization, tenant/runtime protocols | Same as foundation (Fable 5 or Opus 5) | Bugs here are the most expensive to catch late; not worth economizing |
| Main module implementation (phases 2+, once the references exist) | **Grok 4.6 (high, non-fast)** | The cheap workhorse from the Cursor Models pool. Fast mode buys latency at 2× the price — irrelevant for background agents. Works from the spec + reference templates; TDD and CI catch its mistakes. Escalate after 2 failed review iterations |
| Boilerplate, mass edits, template-driven refactors | **Composer 2.5** | Cheapest tier; the pattern is already set by the reference |
| Routine PR code review | **GPT-5.6 Terra (high)** — a different family than the implementer (both Grok and Claude) | + **Bugbot** on every PR as a separate layer. Cross-family review catches the implementer's systematic blind spots |
| Foundation / sensitive PR review (auth, payments, QES, webhooks, migrations, core) | **GPT-5.6 Sol (high/xhigh)** + security-review agent | Independent deep pass; reviewer stronger than the implementer where it matters |
| Debugging hard bugs | **Claude Opus 5 (thinking, high)** — always a different family than the model whose code is failing | Escalation when the working model can't find the root cause in 1–2 iterations |

Cost model in one line: expensive reasoning is spent where errors are
irreversible or template-setting (specs, foundation, security, review);
volume code generation runs on the cheap model under the supervision of
tests, CI, and a stronger reviewer.

Practice in Cursor: specifications — in Plan mode; implementation — parallel
cloud agents on separate branches; review — Bugbot + a reviewer agent; the
stages run through the commands in `.cursor/commands/` (`/spec`, `/plan`,
`/scaffold`, `/implement`, `/review`, `/ticket`, `/rework-spec`) —
see `docs/pipeline.md` for the day-to-day workflow including Linear.

### 7.4 Pipeline health metrics

- % of PRs merged without human edits (target: >80% after the reference stabilizes).
- Number of review iterations per PR (target: ≤2).
- Time from spec to green CI per module.
- Regressions reaching main (target: ~0 — caught in CI/review).

---

## 8. Roadmap (mobile-first)

Detailed roadmap with readiness criteria: `docs/scope.md` §7.
Condensed view:

| Phase | Contents | Result |
| --- | --- | --- |
| **0. Foundation** | Monorepo, CI, Docker Compose (Postgres+Redis+MinIO), core/db/contract, better-auth, API/worker + Expo skeleton, minimal Universal/App Links, payment + feature-flag skeletons, security/operations baseline, **foundation invariants (§2.1) verified by tests** | A skeleton on which agents can work in parallel |
| **1. Reference slices** | Merge approved minimal prerequisite schemas, then pricing resolution + a thin order → outbox → chat projection: spec → plan → TDD → review | Query and transactional/event templates to copy + a proven pipeline |
| **‖ Experience Foundation** | Competitor research → IA → tokens/components → prototypes → internal evaluation (parallel to phases 0–1; gates product UI) | UX gate passed with evidence limitations recorded |
| **2. Company operating core** | `companies`, `catalog` (with variants), `customers`/groups, `invites`, `pricing` full UI + mobile panel screens | Company and catalog created from a phone |
| **3. Company presence** | Public profile/showcase, business-category taxonomy, deep links, entry journeys (invite, direct link) | A customer follows a link and enters the company |
| **4. Consumer discovery** | `search` (FTS/trigram), `consumer` principal, category filters, search → profile → cart (ADR-0018) | A signed-in user discovers a company without a prior invite |
| **5. Commerce core** | `orders` + cart/checkout + `delivery` (Nova Poshta) + push; atomic CRM link on checkout; no chat coupling | An order is placed and progresses through statuses |
| **6. Chat platform** | `chat`: conversations, messages, realtime, offline/reconnect, push | Real-time conversation works end-to-end |
| **7. Order collaboration** | Order-card projection in chat, redirect-to-chat, confirm/edit/cancel | The canonical §1.1 flow works end-to-end |
| **8. Documents + QES** | `documents`, `doc-generation` (PDF worker), `doc-signing` (Nitro, ASiC-E, pki-proxy) + mobile-editing spike | B2B document workflow with signing from phones |
| **9. AI experience** | `packages/ai`: agent over the action registry, UI tools, generative UI; classic/AI parity validation | AI performs the same actions as the UI |
| **🚀 V2 Production Launch** | Data migration, TestFlight → stores | Real users on 2.0 |
| **10. Web** | Next.js: storefront (SEO), cabinet, full panel, Plate template editor, full browser continuation from existing links | Orders without the app |
| **11. Acquiring** | `acquiring` on top of the ready payment abstraction | Online payment |
| **12. Bank + accounting** | `banking`: statements, matching; income ledger on real transactions (Taxer replacement) | Tax reporting from Showzy |

Phases 5 and 6 (Commerce core, Chat platform) may proceed in parallel after
shared prerequisites. Phase 7 (Order collaboration) requires both.

---

## 9. Scaling (built in from day one)

- API — stateless, horizontal scaling behind the Socket.IO Redis adapter.
- Workers — a separate process (`apps/worker`), scales independently; Puppeteer lives only there.
- Postgres — vertically + a read replica for analytics/search when needed.
- L1 cache (memory) + L2 (Redis) — pattern from the current system.
- Rate limiting on actions (especially AI calls) — in the core action execution pipeline (`packages/core`), designed in the core spec.
- Structured logs with `request_id`/`action`/`companyId` — correlation from HTTP to worker.
