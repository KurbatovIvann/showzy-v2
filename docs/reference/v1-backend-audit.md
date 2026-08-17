# Showzy v1 — Backend & Database Audit

> Full snapshot of `apps/api` (NestJS) and the database (Supabase Postgres) as
> input for the rewrite. Source: code analysis + 83 migrations, August 2026.
> Companion artifacts: `v1-database.types.ts` (generated types, has minor
> drift — signature columns, `assistant_search_*` RPC) and `v1-migrations/`
> (authoritative schema record).

## Headline numbers

| Metric | Value |
| --- | --- |
| TS files / lines in `src` | 330 / ~35,500 |
| HTTP endpoints (controllers) | ~87 (22) |
| Tables in `public` | 77+ (+4 in `analytics`) |
| RLS policies | ~240 |
| RPC functions / triggers | 79 / 82 |

## Functional modules (19)

| Domain | Modules | What they do |
| --- | --- | --- |
| Commerce | documents, document-generation, document-signing | Document CRUD; Plate JSON → HTML (React SSR) → PDF via Puppeteer; QES: digest preparation, ASiC-E packaging, verification via UAPKI WASM |
| Payments | mono-acquiring, monobank | Two separate integrations: acquiring (invoices, fiscalization, webhooks) and personal API (statement sync, matching transactions to orders) |
| Communications | chat, conversations, messages, messaging-channels | Company↔customer chat; multichannel: web + Instagram/Messenger via Meta webhooks and Graph API |
| Delivery | delivery | Nova Poshta: city/warehouse/street search, local dictionary cache, daily cron sync |
| AI | assistant, search | "Shozik" assistant (Claude + tool calling over allowed tables/RPC, SSE streaming); search with OpenAI embeddings |
| Notifications | notifications, email, sms | In-app + Expo push; Resend; Kyivstar/SMS-Fly; transactional outbox |
| Other | analytics, auth-hooks, invites, pki-proxy | Dashboard analytics + event tracking; custom OTP delivery for Supabase Auth; customer invites; CORS proxy to Ukrainian CAs (OCSP/TSA) |

## Infrastructure subsystems

- **Realtime — Socket.IO (Redis adapter).** Two gateways: `/chat` (rooms
  `user:id` and `conversation:id`; send/edit/delete, reactions, typing, read
  receipts) and `/presence` (online statuses + business events: new orders,
  transactions, invoice statuses, sync completion). Realtime is a first-class
  part of the product, not an add-on.
- **BullMQ (Redis), 7 queues**: pdf-generation, email, sms, push-notification,
  meta-message, embedding, analytics-events. Retry with exponential backoff,
  leader election for cron in multi-instance mode.
- **Transactional outbox (Postgres).** `domain_events` table, claim via RPC
  (`FOR UPDATE SKIP LOCKED`), poller with adaptive backoff woken by
  LISTEN/NOTIFY. A ~1,400-line processor maps events to notifications and
  side effects. The most valuable pattern to carry over.
- **Schedulers**: Nova Poshta sync (daily), Monobank (~65 s + every 6 h),
  Meta import (every minute) + `pg_cron` in the DB (invite expiry, analytics
  partition maintenance).

**Heavy / non-standard parts**: Puppeteer (Chromium) for PDF; UAPKI WASM —
DSTU cryptography; ASiC-E packaging (zip); React SSR of Plate documents on the
backend; SSE streaming for the assistant; rawBody for Meta webhook signatures;
streaming proxy to CAs; DOCX export.

## Database

| Domain | Key tables | Notes |
| --- | --- | --- |
| Companies / team | companies, company_members, company_legal_info, showcase_config | RBAC: role + permissions jsonb; sole proprietor / legal entity data for documents; FTS + embedding on companies |
| Catalog | products, product_variants, product_options, product_images | Variants with price/stock overrides; UKTZED, SKU sequences; FTS + embedding |
| Pricing | price_lists, price_list_items, customer_product_prices, customer_groups | 5 priority levels (below); no separate promo/discount entity |
| Orders | orders, order_items, order_logs, order_deliveries | Product snapshots in line items; audit trail; `tracking_token` for public tracking |
| Statuses / workflow | company_statuses, status_transitions, status_automations | Custom per-company workflows + templates + auto-transitions on payment/delivery |
| Documents / QES | documents, document_signatures, document_templates, counterparties | PlateJS JSON + requisites snapshots; supplier/counterparty signatures; trigger recomputes `signature_status` |
| Chat | conversations, messages, conversation_participants, message_mentions | `sequence_number`, soft delete, read cursors; attachments in Storage, not DB |
| Payments / bank | payments, bank_transactions, mono_acquiring_invoices, integration_secrets | Secrets via vault helpers; statement-to-order matching |
| SaaS mechanics | subscription_plans, feature_flags, company_feature_overrides | Plans + feature gating already modeled |
| UA dictionaries | kved_codes, cpv_codes, delivery_cities/warehouses/streets | Classifiers with `search_vector`; Nova Poshta dictionary cache |

### Price resolution hierarchy (`resolve_product_price`)

```
1. customer_product_prices   # personal price
2. customer's price_list     # customer price list
3. group's price_list        # customer-group price list
4. default price_list        # company default
5. products.price            # base price
```

### Postgres extensions

pgvector (HNSW, 1536-d embeddings on companies / products / customers),
pg_trgm + unaccent (fuzzy search), pg_cron, pg_partman (analytics.events
partitions). Requirement for the new Postgres hosting: all of these — all
available in standard builds.

### RLS — the biggest migration artifact

~240 policies across ~81 tables, built around `has_company_permission()` and
`auth.uid()`. A consequence of web/mobile clients querying Postgres directly
via supabase-js/PostgREST. In the new architecture with a dedicated API this
layer is replaced by permissions in `defineAction` — the permission model
(`role_permission_defaults` + overrides) carries over conceptually 1:1, but
this is the largest rethinking effort of the rewrite.

## Will Hono handle this? — load breakdown

Key observation: almost everything "heavy" in this backend lives outside the
HTTP framework. The framework is a thin routing wrapper.

| Subsystem | Depends on | HTTP framework's role |
| --- | --- | --- |
| Socket.IO (chat, presence) | Node http server + Redis adapter | None — gateways attach to the server, not the framework |
| BullMQ workers, cron, outbox | Redis + Postgres, separate processes | None |
| Puppeteer PDF, UAPKI WASM, ASiC-E | Node runtime, CPU/memory | None |
| Assistant SSE streaming | Streamed HTTP response | Hono: `streamSSE` out of the box, fetch-native |
| Meta webhooks (rawBody + signature) | Raw request body access | Hono: `c.req.raw` — natural; in Nest this was a workaround |
| PKI proxy to CAs | Request/response streaming | Hono: fetch proxy in a few lines |
| ~87 REST endpoints | Routing + validation + guards | Covered by the action registry + oRPC; the framework only mounts |

**Verdict**: yes — because the load is carried by the Node process, Postgres,
and Redis, same as today. The three places where the framework actually
touches complex flows (SSE, webhook raw body, streaming proxy) are simpler in
fetch-native Hono than in the current NestJS.

## Corrections to the final architecture based on the audit

1. **Redis from day one, BullMQ instead of pg-boss** (decision revised).
   Redis is mandatory anyway — Socket.IO adapter for multi-instance realtime,
   L2 cache, leader election. Given Redis exists, BullMQ is the more mature
   queue choice and the patterns are established (7 queues, retry, backoff).
   Redis is a docker container next to Postgres, not vendor lock-in.
2. **Outbox pattern carries over almost unchanged** (confirmation).
   `domain_events` + claim via SKIP LOCKED + LISTEN/NOTIFY is exactly what
   the new architecture planned. Only the consumer changes: instead of a
   monolithic 1,400-line processor — module subscriptions to events through
   the bus in `packages/core`.
3. **The biggest migration effort is authorization, not code** (scope
   clarification). ~240 RLS policies and ~79 RPC exist because clients query
   the DB directly. In the new architecture all of this collapses into
   `defineAction` (permissions) and Drizzle queries (instead of RPC). The
   `has_company_permission` model carries over conceptually 1:1. Business
   logic in triggers (numbering, statuses, unread counters) — a deliberate
   per-trigger decision: keep in DB or lift into code.
4. **AI-first is a generalization of the existing assistant** (confirmation).
   "Shozik" already does tool calling over allowed tables and RPC with
   streaming. The action registry turns this ad-hoc toolset into a systematic
   one: every product action automatically becomes an assistant tool — with
   the same permissions as the UI.
5. **Modules missing from the earlier final structure** (new in scope):
   messaging-channels (Meta/Instagram — separate module with webhooks and
   import), analytics (partitioned events + daily aggregates), auth-hooks
   (custom OTP delivery — in the new architecture just better-auth config),
   pki-proxy, statuses (custom workflows), invites, subscriptions / feature
   flags.

---

Sources: `apps/api` (330 TS files), `supabase/migrations` (83 files,
03.2026–04.2026), `packages/database`. Note: `database.types.ts` has drift
relative to migrations (signature columns, `assistant_search_*` RPC) —
regenerate before relying on it.
