# v1 → v2 migration decision matrix

> Status: Approved framework and current decisions (owner, 2026-08-17).
> Column mappings and reconciliation queries are completed in each module
> spec before its schema task; `REVIEW` rows intentionally remain hard
> blockers until the relevant product/domain spec resolves them.
> Sources: `v1-backend-audit.md`, `v1-database.types.ts`, and all files under
> `v1-migrations/` (migrations are authoritative when generated types drift).

## Source inventory and drift

- 83 migration files; 77 public + 4 analytics base tables.
- 116 unique function names in migrations (79 public RPCs in generated types
  plus trigger/internal helpers), 82 triggers.
- Approximately 238 final unique RLS policy names; 438 `CREATE POLICY`
  statements including recreations.
- Five v1 extensions and four storage buckets.
- Migrations contain three `assistant_search_*` RPCs missing from generated
  types; analytics partition children in types are pg_partman runtime
  artifacts, not owned base tables. `company_details` was created and later
  dropped. These are explicit drift flags, not objects to infer from types.

## Decision vocabulary and gate

- **KEEP** — same business object, redesigned Drizzle schema.
- **TRANSFORM** — behavior/data moves to the named owner or protocol.
- **DEFER** — retained only for a named post-MVP phase; no MVP schema.
- **DROP** — no v2 data/code.
- **REVIEW** — product/data decision still required; scaffold is blocked.

For each KEEP/TRANSFORM table, its module spec must add column-level
source→target mapping, defaults/nullability, data cleanup, row counts,
reconciliation query, cutover order, and rollback/restore procedure. Every
v1 RLS policy is dropped; its operation must map to a named action/target
resolver test in that same spec.

## Tables

| v2 owner | KEEP / TRANSFORM | DROP / DEFER / REVIEW |
| --- | --- | --- |
| auth/foundation | `users` → better-auth identity/profile split; `domain_events` → new envelope/delivery protocol | `verifications` → DEFER with company verification; Supabase sessions → DROP/invalidate |
| companies | `companies`, `company_members`, `role_permission_defaults`, `company_legal_info`, `company_socials`, `showcase_config` → TRANSFORM | `business_categories`, `company_business_categories` → REVIEW: retain profile taxonomy or drop with marketplace |
| customers | `company_customers`, `customer_groups`, `customer_legal_info`, `counterparties` → TRANSFORM | — |
| catalog | `product_categories`, `unit_types`, `products`, `product_images`, `product_options`, `product_option_values`, `product_variants`, `product_variant_options`, `company_sku_sequences` → TRANSFORM | `product_comments`, `product_likes` → DROP |
| pricing | `price_lists`, `price_list_items`, `customer_product_prices` → TRANSFORM; group links come from `customer_groups` | — |
| orders | `carts`, `cart_items`, `orders`, `order_items`, `order_logs`, `company_statuses` → TRANSFORM to fixed workflow | `status_templates`, `status_template_items`, `status_template_transitions`, `status_transitions`, `status_automations`, `status_template_auto_transitions`, `status_auto_transitions` → DROP; `checkout_sessions`, `user_checkout_preferences` → REVIEW in orders spec |
| payments | `payments`, relevant invoice settings from `payment_settings` → TRANSFORM | LiqPay settings/rows → DROP; `mono_acquiring_invoices` → DEFER to acquiring |
| delivery | `delivery_cities`, `delivery_warehouses`, `delivery_streets`, `company_delivery_methods`, `order_deliveries` → TRANSFORM | Meest-specific values → DROP |
| chat | `conversations`, `messages`, `conversation_participants`, `message_reactions` → TRANSFORM | `message_mentions` → REVIEW in chat spec; `messaging_contacts`, `meta_data_deletion_requests` → DROP with Meta |
| notifications | `user_devices`, `notifications` → TRANSFORM | legacy web-push fields → DROP |
| invites | `company_customer_invites` → TRANSFORM | — |
| documents | `document_templates`, `default_document_templates`, `documents`, `document_number_counters`, document-side counterparty snapshots → TRANSFORM | — |
| doc-signing | `document_signatures` and signature columns/artifacts → TRANSFORM with carried-over crypto vectors | — |
| reference-data | `kved_codes`, `cpv_codes` → KEEP as global imported data | — |
| feature-flags | `feature_flags`, `company_feature_overrides` → TRANSFORM | `subscription_plans`, `company_subscriptions` → DEFER to subscriptions |
| integrations/post-MVP | `bank_transactions` → DEFER to banking; provider-specific company integration metadata → DEFER to owning provider module | `company_integrations`, `integration_secrets` generic v1 design → REVIEW after secret-storage/provider split; LiqPay/Meta rows → DROP |
| analytics/search | no partitioned analytics tables carried over; MVP direct queries/FTS projections are rebuilt | `analytics.company_daily_stats`, `company_product_daily_stats`, `company_customer_daily_stats`, `analytics.events` → DROP |
| social/marketplace | — | `company_follows` → DROP |

## Views and enums

| Object | Source | Decision |
| --- | --- | --- |
| `products_view` | `20260317000001_payments_fiscal_checkout.sql:154` | TRANSFORM to catalog read action/service |
| `consumer_products_view` | same migration `:213` | REVIEW: slim company-profile read or drop marketplace shape |
| `product_comments_view` | `20260313000001_product_comments_view.sql:8` | DROP with comments |
| `carts_view` | `20260301000011_carts.sql:328` | TRANSFORM to orders read action |
| `public_profiles` | `20260401000001_security_hardening.sql:146` | TRANSFORM to public company/profile action |
| `company_details` | dropped by `20260320000008_drop_company_details_view.sql:158` | Already absent from final v1 state |
| `order_log_action` | `20260301000012_orders.sql:35` | TRANSFORM to orders text+CHECK contract |
| `delivery_method_type` | `20260301000014_delivery.sql:22` | TRANSFORM; remove `meest` |
| `delivery_sub_type`, `delivery_status` | same migration `:29,:35` | TRANSFORM to delivery text+CHECK |
| `notification_type` | `20260301000016_notifications.sql:28` | TRANSFORM; remove dropped social/Meta values and defer acquiring values |
| `notification_recipient_role` | same migration `:47` | TRANSFORM to notifications text+CHECK |

## Functions and RPCs

Repeated `CREATE OR REPLACE` definitions below are one logical object; the
latest migration is the source behavior to inspect.

- **Foundation/auth → core/db or DROP:** `update_timestamp` (shared technical
  trigger); `is_company_owner`, `is_company_member`, `has_no_company_members`,
  `has_company_permission`, `is_customer_of_company_member`,
  `is_anonymous_user` → DROP and replace with principal factories/target
  resolvers; `sync_users_with_auth`, `protect_users_synced_columns`,
  `check_username_available` → better-auth migration/actions.
- **Identifiers/default setup → owner services/actions:** `to_base36`,
  `obfuscate_seq`, `set_company_prefix`, `generate_order_number`,
  `set_order_number`, `next_document_number`, `set_document_number`,
  `trg_auto_generate_sku`, `create_default_company_data`,
  `create_company_onboarding`, `assign_free_plan_to_new_company`,
  `auto_enable_bank_transfer`.
- **Catalog/profile/search → actions:** `haversine_km`,
  `escape_like_pattern`, `immutable_array_to_string`, `get_public_profiles`,
  `get_company_page`, `get_company_products`, `get_products_by_ids`,
  `search_suggestions`, `search_browse`, `assistant_search_products`,
  `assistant_search_customers`, `assistant_search_counterparties`,
  `assistant_search_orders`.
- **Customers/pricing/invites → actions/services:** `resolve_product_price`,
  `resolve_product_prices_batch`, `ensure_single_default_price_list`,
  `get_invite_details`, `accept_company_customer_invite`,
  `create_company_customer_link_user`.
- **Orders/cart/status → actions/services:** `validate_cart_company`,
  `update_cart_items_bulk`, `refresh_cart_prices`, `create_order_secure`,
  `create_company_order`, `update_order_items_secure`,
  `get_order_by_tracking_token`, `fn_orders_resolve_counterparty`,
  `validate_order_status_transition`, `auto_transition_on_payment_change`,
  `auto_transition_on_delivery_change`.
- **Payments/integrations → owner actions:** `get_checkout_payment_info`,
  `upsert_checkout_session`, `get_mono_acquiring_token`,
  `process_mono_acquiring_webhook`, `store_integration_secret`,
  `get_integration_secret`, `delete_integration_secrets`,
  `get_liqpay_credentials`, `match_bank_transaction_to_order`,
  `unlink_bank_transaction`.
- **Delivery → actions/services:** `upsert_delivery_city`,
  `upsert_delivery_warehouse`, `get_delivery_warehouses`,
  `upsert_delivery_street`, `get_delivery_streets`.
- **Chat/notifications → actions/event handlers:** `toggle_message_reaction`,
  `update_conversation_on_message`, `create_conversation_participants`,
  `update_conversation_assignment`, `find_order_conversation`,
  `increment_unread_count`, `get_conversation_recap`,
  `deactivate_stale_devices`, `mark_all_notifications_read`,
  `cleanup_old_notifications`.
- **Documents/signing → actions/services:** `get_company_templates`,
  `documents_soft_delete`, `can_read_document_object`,
  `recompute_document_signature_status`.
- **Outbox → core protocol:** `claim_domain_events`,
  `cleanup_processed_domain_events`, `handle_domain_event_failure`, all
  `fn_*_outbox` functions. V2 uses explicit `ctx.emit`, deliveries, and replay.
- **Analytics → DROP/rewrite as simple dashboard actions:**
  `analytics_upsert_daily_stats`, `analytics_upsert_product_daily_stats`,
  `analytics_upsert_customer_daily_stats`, `analytics.backfill_company_stats`,
  every `analytics_get_*` and `analytics_list_*` RPC.
- **Social counters → DROP:** `toggle_product_like`,
  `toggle_company_follow`, `trg_update_followers_count`,
  `trg_update_likes_count`, `trg_update_products_count`,
  `trg_update_orders_count`.

## Triggers

- **KEEP as one shared technical primitive:** every `*_update_timestamp`,
  `set_*_updated_at`, and `trigger_update_*_timestamp` trigger.
- **MOVE to owner action/service:** `assign_company_prefix`,
  `assign_order_number`, `assign_document_number`,
  `trg_products_auto_sku`, `enforce_single_company_cart`,
  `ensure_single_default_price_list_trigger`,
  `validate_order_status_transition`, `trg_orders_resolve_counterparty`,
  `trg_document_signatures_recompute_status`.
- **MOVE to explicit events/consumers:** all `trg_*_outbox`,
  `auto_transition_on_payment_change`,
  `order_deliveries_auto_transition`, `messages_update_conversation`,
  `conversations_create_participants`,
  `conversations_update_assignment`, `create_default_company_trigger`,
  `auto_enable_bank_transfer_trigger`.
- **DROP:** `trg_followers_count`, `trg_likes_count`,
  `trg_products_count`, `trg_orders_count`, legacy
  `on_auth_user_created`, `protect_users_synced_columns_trigger`,
  `trg_documents_soft_delete` (v2 delete behavior is explicit in spec).

The owning spec must enumerate the exact trigger names from its source
migrations and link each to one of these decisions; a category alone is not a
completed module slice.

## RLS, storage, extensions, scheduled jobs, and identity

- **RLS:** all database/table/storage policies are DROP in v2. For every
  table above, member/customer/public/service-role policies transform into
  action permissions, typed target resolvers, system scope, signed-file
  authorization, and cross-tenant tests. Storage policies on
  `storage.objects` transform to `files` actions; `service_role_only`
  policies transform to runtime DB grants.
- **Buckets:** `documents-bucket`, `chat-attachments`, `companies-bucket`,
  and `users-bucket` → TRANSFORM into private S3/MinIO prefixes owned by
  `files`; public profile assets are served through explicitly public/CDN
  policy, not by trusting client paths.
- **Extensions:** `pg_trgm`, `unaccent` → KEEP; `vector`, `pg_partman`, and
  `pg_cron` → DROP. Invite expiry moves to a BullMQ worker; analytics partman
  maintenance drops with the partitioned pipeline. No extension is enabled
  outside db migrations.
- **Auth:** Supabase auth users → better-auth identities with normalized
  phone/email, deterministic duplicate report, preserved app user mapping,
  no session migration, and forced re-authentication. Reconcile total users,
  usable phone/email identities, duplicates, and unmapped domain FKs.

## Rehearsal and rollback

Each rehearsal records source/target row counts, invalid rows, duplicate
identities, orphan FKs/files, per-module financial totals, and checksum/sample
comparisons. Cutover is restore-capable: immutable source backup + PITR,
maintenance window, migration, reconciliation, explicit go/no-go, and restore
on failure. No destructive v1 write is required; `E:\showzy` remains
read-only throughout development.
