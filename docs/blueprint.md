# Showzy 2.0 — Architecture Blueprint

> Final document: architecture, technology stack, and the SDD agent pipeline.
> Status: approved. Date: August 2026.
> Sources: audit of the current system (apps/api ~36k lines, apps/web ~119k,
> apps/mobile ~58k, 77+ tables, 83 migrations, ~240 RLS policies).

---

## 1. Product

Showzy is a SaaS tool for small businesses in Ukraine (not a marketplace). It
replaces the zoo of services a micro-business juggles (Instagram + Telegram +
spreadsheets + Taxer) with a single app. The reference user is a home
confectionery.

- **Company profile** with a catalog and flexible pricing (5 levels: personal price → client price list → group price list → default price list → base price). Validated on a real case: separate prices for coffee shops, regular customers, and loyal customers.
- **Canonical flow**: customer → company profile → cart → checkout (account required) → **redirect to chat** with an order card. The company confirms/edits/cancels the order in chat. **Chat is the operational core of the product.**
- **B2B add-on**: a customer with a legal profile (sole proprietor / legal entity) gets document workflow — contracts, invoices, delivery notes, **QES signing** (DSTU, ASiC-E) — the private key never leaves the device. Same flow, extra actions.
- **Two management surfaces**: company panel and customer cabinet.
- **Integrations**: Nova Poshta (MVP); Monobank acquiring + bank statements as the foundation of accounting (post-MVP), Resend, SMS.
- **AI assistant** with tool calling — at parity with the UI.
- **Client strategy: mobile-first for all functionality** (panel and cabinet). Web is a post-MVP phase, with universal links.

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

1. **Tenant isolation.** It must be impossible for a business action to read or write another company's data. `companyId` is injected by the action context from the authenticated membership — never accepted from input as an access grant. Verified by an automated cross-tenant test suite that every module inherits. This is what replaces the deleted ~240 RLS policies: code + tests instead of DB policies.
2. **Idempotency.** Order creation, payments, document generation, Nova Poshta calls, webhooks, and AI-invoked actions are safely retryable (idempotency keys where needed). Retries come from everywhere: workers, webhook redelivery, the AI loop.
3. **Money model: immutable snapshots.** An order item stores `unitPriceSnapshot`, `quantity`, `discountSnapshot`, `taxSnapshot`, `total` captured at creation time. An old order is never recomputed from current pricing. Critical given 5-level dynamic pricing and future accounting built on real transactions.
4. **Observability / audit.** Every action execution carries `request_id`, `actor_id` (human or AI), `company_id`, `action` in structured logs; `audit: true` actions write an audit record. Non-negotiable because actions will be invoked by AI.
5. **Projections never own domain state.** Chat is the primary interaction surface for orders, but the order domain is the source of truth: an order card in chat is a projection updated by domain events (`orders.confirm` → `OrderConfirmed` → card update). A chat message stores `orderId`, never order status. `orders` does not know chat exists — it emits events; `chat` subscribes and materializes cards. The same rule applies to every future projection (dashboards, notifications, analytics).

---

## 3. Technology stack (final)

| Layer | Technology | Rationale |
| --- | --- | --- |
| Runtime | **Node.js 22 LTS + TypeScript (strict)** | The whole ecosystem (UAPKI WASM, Puppeteer, Socket.IO) is proven on Node |
| Monorepo | **Turborepo + pnpm** | Already works; shared packages are critical for agents |
| HTTP framework | **Hono** (`@hono/node-server`) | Minimal, fetch-native, explicit. SSE, raw body, streaming proxy — out of the box. Heavy stuff (Puppeteer, WASM, queues) lives outside the framework |
| API contract | **oRPC** | End-to-end types for web/mobile + OpenAPI autogeneration. Kills the hand-written DTO duplicates |
| Database | **PostgreSQL 17** (self-hosted) | Extensions: pgvector, pg_trgm, unaccent, pg_cron, pg_partman — all standard |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Schema in TypeScript = source of types; SQL-like API without magic; versioned migrations |
| Auth | **better-auth** | Self-hosted TS library: email/phone OTP, sessions, native Drizzle integration |
| Storage | **S3-compatible** (MinIO locally → Cloudflare R2 in prod) | Replaces Supabase Storage; signed URLs work the same |
| Queues | **BullMQ + Redis** | Decision revised after the audit: Redis is mandatory anyway (Socket.IO adapter, cache, leader election), and patterns for 7 queues are already established |
| Realtime | **Socket.IO + Redis adapter** | Carried over from the current system almost unchanged |
| Reliable events | **Transactional outbox** (`domain_events` + `FOR UPDATE SKIP LOCKED` + LISTEN/NOTIFY) | Already implemented correctly — carried over |
| Validation | **Zod v4** | One schema: form → API → AI tool → DB boundary |
| AI | **Vercel AI SDK v6** | Tool calling, streaming, generative UI; provider-agnostic (Anthropic/OpenAI) |
| Mobile | **Expo + expo-router + Unistyles** — **primary client** | Mobile-first: all MVP functionality (panel + customer cabinet + AI chat) in the app |
| Web | **Next.js (App Router)** — post-MVP phase | Storefront by link (SEO), cabinet in the browser, desktop template editor; universal links into the app |
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
// packages/core/src/action.ts — concept
export const createOrder = defineAction({
  name: "orders.create",
  description: "Create an order for a company customer", // ← goes into the AI tool
  input: z.object({
    // companyId is NOT here — it is injected by ctx from the authenticated
    // membership (tenant isolation invariant, §2.1)
    customerId: z.string().uuid(),
    items: z.array(orderItemSchema).min(1),
  }),
  output: orderSchema,
  permissions: ["orders:create"],  // checked before the handler

  // AI & execution metadata — designed in at phase 0, consumed from phase 5
  aiExposure: "exposed",           // exposed | internal (never becomes an AI tool)
  risk: "write",                   // read | draft | write | high
  requiresConfirmation: false,     // high-risk: UI renders a human confirmation step
  idempotent: true,                // safe to retry (workers, webhooks, AI loop)
  emits: ["order.created"],        // declared outbox events; CI checks vs ctx.emit
  timeout: 5_000,
  audit: true,                     // written to the audit log

  handler: async (input, ctx) => {
    // ctx: { db, userId, companyId, membership, emit }
    // one transaction; ctx.emit puts the event into the outbox in the same transaction
  },
});
```

From one definition we generate:

1. **oRPC procedure** → typed client for web/mobile + OpenAPI spec.
2. **AI tool** → `name`/`description`/`input` become the tool definition; the handler is the same.
3. **Form schema** → the same Zod schema in react-hook-form.
4. **Permissions + audit** → in one place, regardless of who called.

The AI metadata is part of the definition from phase 0 precisely so that
phase 5 becomes "connect the LLM to the existing capability graph" rather than
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
│  ├─ mobile/         # Expo — primary client (MVP)
│  └─ web/            # Next.js — phase 6 (post-MVP)
├─ packages/
│  ├─ core/           # defineAction, registry, context, event bus, outbox client
│  ├─ db/             # Drizzle schema (source of types), migrations, seed
│  ├─ contract/       # oRPC router generated from the action registry
│  ├─ modules/        # domain modules (see §6) — actions + services + events
│  ├─ ai/             # agent, system prompts, UI tools, generative component mappings
│  ├─ document-signing/  # UAPKI (crypto core carried over; integration re-audited)
│  ├─ validation/     # shared Zod schemas (carried over, extended)
│  ├─ ui/             # shared design tokens/types for web+mobile
│  └─ config/         # eslint (boundaries!), tsconfig, prettier
├─ docs/
│  ├─ blueprint.md              # this document
│  └─ specs/          # module specifications for agents (one .md per module)
└─ .cursor/
   ├─ rules/          # rules for agents (conventions, prohibitions, DoD)
   └─ commands/       # common commands (create module, add action, add migration)
```

### Domain modules (packages/modules/*)

**MVP:** `companies` (+ team, RBAC, legal info) · `catalog` (products, variants, categories) · `pricing` (price lists, personal prices, groups) · `orders` (+ order_logs, fixed statuses) · `chat` (conversations, messages, reactions — the operational core) · `documents` (CRUD, default templates, numbering) · `doc-generation` (Plate → HTML → PDF) · `doc-signing` (QES, ASiC-E, pki-proxy) · `delivery` (Nova Poshta + reference data) · `notifications` (in-app, push, email, sms) · `invites` · `search` (FTS) · `analytics` (simple dashboard)

**Post-MVP:** `acquiring` (Monobank acquiring + fiscalization) · `banking` (statements, matching, accounting foundation) · `subscriptions` (billing; feature flags — from phase 0)

Boundary rule: a module exports only its actions and events. Directly importing
another module's internal files is an ESLint error.

---

## 6. Key data migration decisions

| What | Decision |
| --- | --- |
| DB schema (77+ tables) | Carried over into the Drizzle schema ~1:1; we keep text+CHECK instead of enums |
| ~240 RLS policies | Deleted. Logic → `permissions` on actions. The largest rethinking effort |
| ~79 RPC functions | Rewritten as ordinary module functions on Drizzle (transactions in code) |
| ~82 triggers | A conscious decision for each: technical ones (updated_at, counters) stay in the DB; business logic (numbering, auto-statuses) moves up into code |
| Outbox (`domain_events`) | Carried over as-is: claim via SKIP LOCKED + LISTEN/NOTIFY |
| Storage buckets | `documents-bucket`, `chat-attachments` → same S3 structure, paths in the DB |
| `database.types.ts` (typegen) | Disappears — types are born from the Drizzle schema |
| Auth users | Export from Supabase Auth → import into better-auth (phones/emails preserved) |

---

## 7. SDD agent pipeline

### 7.1 Work phases

```
SPECIFICATION → PLAN → SCAFFOLD → IMPLEMENTATION → REVIEW → VERIFICATION
 (human+agent)  (agent)  (agent)   (agents in parallel)  (agents)   (CI)
```

1. **Specification.** For each module — a file `docs/specs/<module>.md`: purpose, actions (name/input/output/permissions), events, tables, edge cases, acceptance criteria. Written by an agent in Cursor Plan mode, approved by a human. The spec is a contract: the implementing agent may not change it, only send it back for rework.
2. **Plan.** The agent splits the spec into tasks of ≤ ~300 diff lines each, with explicit dependencies. One task = one branch = one PR.
3. **Scaffold.** The first versions of `packages/core`, `db`, `contract`, and one reference module (recommendation: `pricing` — compact, pure logic, easy to test) are written with maximum care: this is the template agents will copy. The lesson of the Encore benchmark: an agent on an empty minimal framework invents anti-patterns — so patterns are locked in before mass code generation.
4. **Implementation.** Parallel agents (Cursor background/cloud agents) — one per task. Each receives: the module spec, this blueprint, the reference module. TDD: tests from the spec first, then code.
5. **Review.** Every PR: (a) Bugbot, (b) a review agent from a different model family than the implementer, (c) for auth/payments/QES — an additional security review. A human looks only at contentious spots and merges.
6. **Verification (CI).** Merging is impossible without green: `tsc --noEmit` → ESLint (boundaries, no `any`, no direct cross-module imports) → Vitest (unit + integration with Testcontainers Postgres) → contract check (a new action without a description/permissions = error) → Playwright smoke.

### 7.2 Rules for agents (`.cursor/rules/`)

- **Code conventions**: action naming (`<module>.<verb>`), module structure, error style (typed, no bare `throw new Error`).
- **Prohibitions**: raw SQL outside Drizzle; `db` access outside a handler; `any`/`as unknown as`; new dependencies without approval; changing `packages/core` in module tasks.
- **Definition of Done**: tests for every action (happy + permission denied + validation fail), updated spec, green CI.
- **Context**: every package has an `AGENTS.md` with local instructions (as in the current repo).

### 7.3 Model selection (Cursor, August 2026 lineup)

Principles: (1) **different model families for writing and review** — one model's systematic blind spots are caught by another; (2) **expensive models front-loaded, cheap models at scale** — top-tier models build the foundation and the reference (phases 0–1); once the template exists, mass implementation shifts to a cheap fast model, because the pipeline (reference module + TDD + CI + review by a stronger model) is what guarantees quality, not the implementer's raw capability; (3) the Cursor model lineup changes monthly — the table below describes roles; substitute current equivalents.

| Pipeline role | Model | Why |
| --- | --- | --- |
| Architecture, specifications, migration plan | **Claude Opus 5 (thinking, high)** or **GPT-5.6 (xhigh)** | Maximum reasoning depth; a mistake at this level is the most expensive. Rare invocations — cost is negligible |
| Foundation (phases 0–1): `packages/core`, `db`, `contract`, reference module | **Claude Fable 5 (thinking)** | Code that becomes the template for everything else must be impeccable. Expensive, but bounded: used front-loaded, not permanently |
| Sensitive surfaces at any phase: auth, payments, QES, webhooks | **Claude Fable 5 (thinking)** | Bugs here are the most expensive to catch late; not worth economizing |
| Main module implementation (phases 2+, once the reference exists) | **Grok 4.5 (fast, high)** | The cheap workhorse. Works from the spec + reference template; TDD and CI catch its mistakes. Escalate a task to Fable 5 after 2 failed review iterations |
| Boilerplate, mass edits, template-driven refactors | **Grok 4.5 (fast, high)** | Same model — the pattern is already set by the reference |
| PR code review | **GPT-5.6** — a different family than the implementer (both Grok and Claude) | + **Bugbot** on every PR as a separate layer. Reviewer must be stronger than the implementer, not cheaper |
| Security review (auth, payments, QES, webhooks) | **GPT-5.6 (xhigh)** + security-review agent | Independent deep pass over sensitive surfaces |
| Debugging hard bugs | **Claude Opus 5 (thinking, high)** | Escalation when the working model can't find the root cause in 1–2 iterations |

Cost model in one line: expensive reasoning is spent where errors are
irreversible or template-setting (specs, foundation, security, review);
volume code generation runs on the cheap model under the supervision of
tests, CI, and a stronger reviewer.

Practice in Cursor: specifications — in Plan mode; implementation — parallel
cloud agents on separate branches; review — Bugbot + a reviewer agent;
repetitive operations — custom commands (`/new-module`, `/new-action`,
`/new-migration`).

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
| **0. Foundation** | Monorepo, CI, Docker Compose (Postgres+Redis+MinIO), `packages/core`, `db`, better-auth (OTP, account required), oRPC bridge, Expo skeleton, payment abstraction, **foundation invariants (§2.1) verified by tests** | A skeleton on which agents can work in parallel |
| **1. Reference** | The `pricing` module in full: spec → actions → tests → review | A template to copy + a proven pipeline |
| **2. Companies, catalog, customers** | `companies`, `catalog` (with variants), `invites`, customers/groups + mobile panel screens | Company and catalog created from a phone |
| **3. Order vertical** | `orders` + profile/cart/checkout + `delivery` (Nova Poshta) + **redirect to chat** (`chat`, Socket.IO, push) | The canonical flow end-to-end in the app |
| **4. Documents + QES** | `documents`, `doc-generation` (PDF worker), `doc-signing` (Nitro, ASiC-E, pki-proxy) + mobile-editing research spike | B2B document workflow with signing from phones |
| **5. AI layer** | `packages/ai`: agent over the action registry, UI tools, generative UI in the app | AI performs the same actions as the UI |
| **🚀 MVP** | Data migration, TestFlight → stores | Real users on 2.0 |
| **6. Web** | Next.js: storefront (SEO), cabinet, full panel, Plate template editor, universal links | Orders without the app |
| **7. Acquiring** | `acquiring` on top of the ready payment abstraction | Online payment |
| **8. Bank + accounting** | `banking`: statements, matching; income ledger on real transactions (Taxer replacement) | Tax reporting from Showzy |

Phases 2 and 4 partially parallelize across agents after phase 1.

---

## 9. Scaling (built in from day one)

- API — stateless, horizontal scaling behind the Socket.IO Redis adapter.
- Workers — a separate process (`apps/worker`), scales independently; Puppeteer lives only there.
- Postgres — vertically + a read replica for analytics/search when needed.
- L1 cache (memory) + L2 (Redis) — pattern from the current system.
- Rate limiting on actions (especially AI calls) — in `defineAction` middleware.
- Structured logs with `request_id`/`action`/`companyId` — correlation from HTTP to worker.
