# Showzy 2.0 — Scope and Roadmap

> Review of the current system's functionality: what we carry over, simplify,
> defer, and drop. Companion to `blueprint.md`.
> Status: approved by the owner (2026-08-17). Contentious decisions are marked
> ⚠ — they can be reversed before the start of the phase they affect.

---

## 1. Product positioning

**Showzy is a SaaS tool for a company, not a marketplace.**

The product was born from real pain: a home confectionery whose communication
and management are scattered across Instagram, Telegram, spreadsheets, and
Taxer. Showzy **replaces this zoo of services** rather than aggregating it:
customers are pulled into Showzy (link → company profile → order → chat
already here) instead of being collected from external channels into one
inbox. This is exactly why Meta messaging is dropped.

Cold-traffic conversion is not a priority right now — this is a tool for a
business with an existing customer base, not a storefront for cold visitors.

### 1.1 Canonical order flow (what we preserve at all costs)

```
Customer (sole proprietor or regular) → company profile → cart → order
confirmation → REDIRECT TO CHAT with an order card
```

- Both sides see the order in chat. The company **confirms / cancels /
  clarifies details / edits the order** right in the chat.
- **Chat is the primary interaction surface for orders**, not an extra
  feature. Architecturally, however, the order domain is the source of truth
  and chat is a projection: an order card stores `orderId` and is updated by
  domain events (`orders.confirm` → `orders.confirmed` → card update).
  **Chat never owns order state**, and `orders` does not know chat exists
  (see blueprint §2.1, invariant 5).
- For B2B customers (sole proprietor / legal entity) the same flow + a
  document-workflow add-on: contracts, invoices, delivery notes, QES signing.
  B2B ≠ a separate flow; it is a customer with a legal profile who gets
  additional actions.
- Two management surfaces: the company panel (owner/staff) and the customer
  cabinet (own orders, chat, documents).
- **Orders require an account.** No anonymous orders — the owner's decision:
  security matters more than conversion.

### 1.2 Client strategy: mobile-first for everything

**Owner's decision: all functionality ships in the mobile app first (both the
company panel and the customer side). Web is a separate post-MVP phase.**

Rationale: the target user (a micro-business owner) lives on her phone, not at
a laptop. MVP still needs minimal iOS Universal Links / Android App Links for
invites, public company links, order/chat notifications, and QES callbacks:
open the installed app, otherwise show a small install landing page. Phase 6
adds the full "open the app or continue in the browser" experience.

A consequence to accept consciously: in the MVP, document template
customization is limited (the Plate editor is a desktop-grade thing). The MVP
runs on default templates with requisites substitution; full editing arrives
with the web phase or with a mobile editor after the research spike (see §9).

---

## 2. CORE — carried over (MVP, mobile)

| Functionality | Notes |
| --- | --- |
| Companies, team, RBAC, legal requisites (sole proprietor / legal entity) | The permission model carries over 1:1 into action permissions |
| Catalog: products, categories, images, **variants** | ⚠ Variants stay in the MVP — a basic catalog need |
| **Pricing: 5 levels** (personal → client price list → group price list → default price list → base) | Confirmed by the owner on a real case: separate prices for coffee shops, regular and loyal customers. One of the pipeline's two reference slices |
| Customers (CRM), groups, invites | Invites are the primary channel for onboarding customers into the app |
| **Orders + chat — one vertical slice** | Checkout → redirect to chat; confirm/edit/cancel — in chat; action log; tracking |
| Company profile + cart + checkout (in the app) | Account required (OTP). MVP payment — by invoice (see §4) |
| Documents: default templates, numbering, PDF generation | Puppeteer worker. Template customization — post-MVP (§1.2) |
| **QES signing** (ASiC-E, mobile Nitro + node verify) + pki-proxy | `@showzy/document-signing`: the verified crypto core, tests, and signing vectors carry over unchanged; the integration surface is re-audited against the new architecture |
| Socket.IO realtime + **Expo push** | Push is critical for mobile-first: the owner must see a new order instantly. Finish device registration (unfinished in 1.x) |
| Notifications: in-app + push + email (Resend) + SMS (OTP) | |
| Nova Poshta: city/branch/street search + reference-data sync | Needed in checkout |
| KVED/CPV classifiers | Static data, needed for legal requisites |
| **AI layer**: assistant over the action registry, UI tools, generative UI | In the mobile app from the first release (in 1.x it was web-only) |

---

## 3. SIMPLIFIED

| Was | Becomes in 2.0 | ⚠ |
| --- | --- | --- |
| Custom status engine: workflow templates, transitions, automations | A fixed set of order statuses + simple auto-transitions from payment/delivery. The full constructor — a separate phase after launch, if there is demand | ⚠ |
| Analytics: partitioned event pipeline (pg_partman, queue, daily aggregates) | A simple dashboard with direct queries against operational tables. Event tracking — when the need appears | |
| Search: FTS + trigram + pgvector embeddings (OpenAI) | FTS + trigram only. No embeddings, no embedding queue | |
| Subscriptions: plans + billing + feature flags | Only a feature-flag skeleton (toggling features). Billing — after launch | |
| Admin area (templates, delivery) | Minimum: seed default document templates via migrations; a full admin area — with the web phase | |
| Auth hooks (custom OTP delivery for Supabase) | Disappears as a module — it's just provider config in better-auth | |

---

## 4. DEFERRED (needed, but not in the MVP)

| Functionality | When | Rationale |
| --- | --- | --- |
| **Web version** (storefront by link, customer cabinet, full panel, desktop template editor) | Phase 6 — first after the MVP launch | Owner's decision: mobile-first for everything. Web sits on the same oRPC contract — no logic is rewritten, only UI. Web brings deep links: "open in the app or continue in the browser" |
| ⚠ **Mono acquiring** (online payment + fiscalization) | Phase 7 | The MVP runs on invoice-based payment: the platform generates an invoice as a document — a natural flow for small B2B. **Phase 0 requirement:** a `payments` module owns payment records/status and the provider interface; orders link to payment IDs and react to payment events, so acquiring plugs in without changing core |
| **Monobank statements + accounting** | Phase 8 — the next big priority after the core flow | Status elevated after the owner's clarification: statements are not just payment matching but the **foundation of future accounting** (income ledger, tax reporting — a Taxer replacement). Accounting is built on real bank transactions, not on orders in the system. **Phase 0 requirement:** financial data (amounts, currency, payment↔order↔document links) is designed carefully from day one |
| Mobile document template editing | Research spike in parallel with phase 4 (see §9) | Owner: "would be really cool, but technically hard" |
| DOCX export of documents | On user demand | PDF covers the main case |
| Company verifications | Together with billing | |
| Full workflow-status constructor | On demand | See §3 |

---

## 5. DROPPED

| Functionality | Volume that disappears | Why |
| --- | --- | --- |
| **Meta messaging** (Instagram/Messenger) | The channels module: webhooks, Graph API, per-minute cron import, meta-message queue, `messaging_contacts` and `meta_data_deletion_requests` tables, rawBody verification, Meta compliance | Owner's decision + the replacement strategy (§1). The system's largest external dependency; chat becomes single-channel and drastically simpler |
| **Marketplace browsing hub** | (browse) pages, company search, feed | Consequence of §1 |
| **Company follows** | Table, counters, follower notifications | Social mechanics with no transactional value |
| **Product likes and comments** | 2 tables, a view, moderation | Same |
| **Embeddings + pgvector** | OpenAI queue, HNSW indexes, embedding columns on 3 tables | Served the marketplace's semantic search |
| **Anonymous users / guest checkout** | The anonymous flow in auth, `is_anonymous_user()` policies | Owner's decision: account only, security > conversion |
| **LiqPay** | Webhook, result pages | One acquirer (Mono) is enough |
| **Meest** | Enums, a half-built integration | Nova Poshta only |
| Dead code | web-push, empty deprecated email/sms controllers, TipTap as a second editor | |

**Effect:** of the backend's 19 modules, 4 disappear entirely and ~5 more slim
down substantially (analytics, search, subscriptions, statuses, admin). The
heaviest external dependencies disappear: Meta API, a second acquirer, OpenAI
embeddings. Estimated code-surface reduction for the MVP: **~30–35%** versus a
straight port — plus the entire web UI shifts out of the MVP.

---

## 6. Updated module list (packages/modules/*)

**MVP:** `companies` (team/RBAC/profile) · `customers` (CRM/groups/legal
profiles) · `catalog` · `pricing` · `orders` (carts/fixed statuses/log;
owns `company_statuses`) · `payments` (invoice/manual MVP + provider
interface) · `chat` · `documents` · `doc-generation` · `doc-signing` ·
`delivery` · `reference-data` (KVED/CPV) · `notifications` · `invites` ·
`files` (attachments + signed upload URLs) · `feature-flags` · `search`
(FTS) · `analytics` (simple dashboard) · `assistant` (phase 5: AI
conversation persistence)

**Post-MVP:** `acquiring` (ph.7) · `banking` + accounting (ph.8) ·
`subscriptions`/billing · workflow constructor

**Infrastructure:** `pki-proxy` (part of the doc-signing surface)

The exact ownership/composition ledger is `docs/module-ownership.md`.

---

## 7. Roadmap (mobile-first)

Principle: every product phase ends with a working vertical slice in the
mobile app. Phases 2 and 4 partially parallelize after both reference slices.

| # | Phase | Contents | Readiness criterion |
| --- | --- | --- | --- |
| 0 | **Foundation** | Monorepo, CI (typecheck/lint/tests/contracts/migration drift), Docker Compose (Postgres 17 + Redis + MinIO), `packages/core`, `db`, better-auth, oRPC/client-safe contract, minimal API/worker, **Expo app skeleton + Universal/App Link routing and install fallback**, `payments` provider abstraction, `feature-flags` skeleton, backup/restore baseline, and foundation invariant suites | An agent can add an action from the template and see green CI; the app signs in and opens an invite deep link; cross-tenant/protocol suites pass; a restore drill is specified |
| 1 | **Reference slices** | After approved minimal prerequisite schemas: (a) pricing resolution for pure/query/`ctx.call`; (b) thin order → transactional outbox → chat projection for write/idempotency/event patterns. Full SDD cycle and pipeline shakedown | Two exemplary references + proven pipeline; review metrics collected |
| 2 | **Companies, catalog, customers** | `companies` (onboarding, team, RBAC, requisites), `catalog` (products, variants, categories, images → S3), `invites`, customers/groups. Mobile panel screens: products, prices, customers | A company is created from a phone, the catalog fills up, a customer is invited via invite |
| 3 | **Order vertical: profile → cart → checkout → chat** | `orders` (fixed statuses, log), company profile in the app, cart, checkout with delivery selection (`delivery`/Nova Poshta) → **redirect to chat** (`chat` + Socket.IO + Redis adapter): order card, confirm/edit/cancel, `notifications` + **Expo push** | A customer places an order from her phone; the owner gets a push and confirms the order in chat. The canonical flow of §1.1 works end-to-end |
| 4 | **Documents + QES (B2B add-on)** | Counterparty requisites, `documents` (generation from an order using default templates), `doc-generation` (PDF worker), `doc-signing` (Nitro signing, ASiC-E, pki-proxy), document card in chat. In parallel: the mobile-editing research spike (§9) | An invoice/delivery note is generated from an order and signed with QES by both parties from their phones |
| 5 | **AI layer** | `packages/ai`: agent over the action registry, client-side UI tools (navigate/openModal/prefillForm), generative UI in the assistant chat, human-in-the-loop for QES | The AI in the app performs the same actions as the UI: creates a document, fills a form, shows an order |
| — | **🚀 MVP launch** | Data migration (users → better-auth, files → S3, tables), TestFlight/internal track → stores | The confectionery runs on Showzy 2.0 from a phone |
| 6 | **Web** | Next.js: storefront by link (SEO), customer cabinet, full panel, desktop template editor (Plate), universal links "open in the app or in the browser" | A customer without the app places an order in the browser |
| 7 | **Acquiring** | `acquiring`: Mono invoices, webhooks, fiscalization, merchant onboarding — plugs into the payment abstraction from phase 0 | Online payment in checkout |
| 8 | **Bank + accounting** | `banking`: statement sync, matching transactions to orders/invoices; an income ledger on real transactions, export for tax reporting (Taxer replacement) | The owner sees real income and closes tax reporting from Showzy |
| 9 | **On demand** | Billing/subscriptions, workflow constructor, DOCX, event analytics, mobile template editor (per spike results) | — |

### Why the AI layer is phase 5, not phase 1

AI tools are generated from the action registry. While there are no actions,
the assistant has nothing to execute. But the registry itself (phase 0) is
designed with AI requirements from day one: each action's `description` is
written as an instruction for the model, and every action carries AI/risk
metadata (`aiExposure`, `risk`, `requiresConfirmation`, `idempotent` — see
blueprint §4) from its first commit. This is what makes phase 5 "connect the
LLM to the existing capability graph" instead of "rewrite half the backend
for AI". The visible chat interface appears once there is a critical mass of
actions.

---

## 8. Decision register

| Decision | Accepted | Status / how to reverse |
| --- | --- | --- |
| Marketplace | No — SaaS tool | Approved by the owner. A browsing hub is a separate phase on top of storefronts; the core does not change |
| Mobile vs web | **Mobile-first for all functionality**, web — phase 6 | Approved by the owner |
| Anonymous orders | No — account only (OTP) | Approved by the owner: security > conversion |
| Meta messaging | Dropped | Approved by the owner |
| Acquiring in the MVP | No — invoice-based payment | ⚠ Pull phase 7 before launch; +3–4 weeks to MVP. The phase-0 payment abstraction makes this painless |
| Monobank statements | Phase 8, status elevated to accounting foundation | Approved by the owner: the next priority after the core flow |
| Status constructor | Simplified to fixed statuses | ⚠ `orders` owns `company_statuses`; MVP seeds a fixed set. A future constructor adds UI/actions without moving table ownership |
| Product variants | In the MVP | ⚠ If deadlines squeeze — moved out of phase 2 into a separate one |
| 5-level pricing | In the MVP without simplifications | Approved by the owner on a real case |

---

## 9. Research spike: document editing on mobile

The owner wants the ability to edit documents from a phone; it is known to be
technically hard. The spike runs in parallel with phase 4, time-boxed
(1–2 weeks of agent work); the result is a prototype or a substantiated "no".

**Primary candidate:** Expo DOM components (`"use dom"`) — an Expo mechanism
that renders React DOM components inside a native app. Hypothesis: the same
Plate editor that will run in the web phase launches as a DOM component inside
the app. Upside: one editor for all platforms, zero duplication. Risks to
verify: performance on long documents, keyboard/scroll/selection behavior on
iOS and Android, bundle size.

**Fallbacks:** (a) a WebView with a simplified editor; (b) a mobile
"structural" editor without rich text — editing fields, line items, and
amounts without free-form layout (covers 90% of real needs: fix an amount or
add a line item to an invoice).

**MVP minimum without the spike:** documents are generated from default
templates; only data (requisites, line items, amounts) is edited via regular
forms.
