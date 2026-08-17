-- ============================================================================
-- Migration: analytics_security_hardening
-- Description: Locks down analytics RPC execution privileges to service_role
--              only, enables RLS on analytics.events, and adds DB-level CHECK
--              constraints for defense-in-depth validation.
-- Dependencies: 20260402000001_analytics_schema,
--               20260402000002_analytics_aggregation_rpcs,
--               20260402000003_analytics_retention_and_backfill_fix,
--               20260402000004_analytics_response_rate
--
-- Security references:
--   security-privileges (Principle of Least Privilege)
--   security-rls-basics (Enable RLS on all tables)
--   security-sanitize-output (DB-level defense-in-depth)
-- ============================================================================


-- ############################################################################
-- PART 1: REVOKE PUBLIC EXECUTE ON ANALYTICS RPCs (security-privileges)
-- ############################################################################
-- All analytics RPCs are SECURITY DEFINER in the public schema, making them
-- callable by anon/authenticated via PostgREST by default. Since all calls
-- originate from the NestJS API using the service_role client, we restrict
-- execution to service_role only.

-- Upsert functions (write path)
revoke execute on function public.analytics_upsert_daily_stats(uuid, date, int, numeric, numeric, int) from public, anon, authenticated;
grant execute on function public.analytics_upsert_daily_stats(uuid, date, int, numeric, numeric, int) to service_role;

revoke execute on function public.analytics_upsert_product_daily_stats(uuid, uuid, date, int, int, numeric) from public, anon, authenticated;
grant execute on function public.analytics_upsert_product_daily_stats(uuid, uuid, date, int, int, numeric) to service_role;

revoke execute on function public.analytics_upsert_customer_daily_stats(uuid, uuid, date, int, numeric) from public, anon, authenticated;
grant execute on function public.analytics_upsert_customer_daily_stats(uuid, uuid, date, int, numeric) to service_role;

-- Aggregation RPCs (read path)
revoke execute on function public.analytics_get_period_stats(uuid, date, date) from public, anon, authenticated;
grant execute on function public.analytics_get_period_stats(uuid, date, date) to service_role;

revoke execute on function public.analytics_get_top_products(uuid, date, date, int) from public, anon, authenticated;
grant execute on function public.analytics_get_top_products(uuid, date, date, int) to service_role;

revoke execute on function public.analytics_get_top_customers(uuid, date, date, int) from public, anon, authenticated;
grant execute on function public.analytics_get_top_customers(uuid, date, date, int) to service_role;

-- Response rate RPCs
revoke execute on function public.analytics_get_response_rate_stats(uuid, date, date) from public, anon, authenticated;
grant execute on function public.analytics_get_response_rate_stats(uuid, date, date) to service_role;

revoke execute on function public.analytics_get_response_rate_chart(uuid, date, date) from public, anon, authenticated;
grant execute on function public.analytics_get_response_rate_chart(uuid, date, date) to service_role;

-- Backfill function (analytics schema — not exposed by PostgREST, but
-- defense-in-depth per security-privileges)
revoke execute on function analytics.backfill_company_stats(uuid, date, date) from public, anon, authenticated;
grant execute on function analytics.backfill_company_stats(uuid, date, date) to service_role;


-- ############################################################################
-- PART 2: ENABLE RLS ON analytics.events (security-rls-basics)
-- ############################################################################
-- The events table stores raw behavioral data (page views, product views,
-- searches). It is accessed exclusively via service_role from the API.
-- A deny-all policy documents the intent and prevents accidental exposure
-- if the analytics schema is ever added to exposed_schemas.

alter table analytics.events enable row level security;
alter table analytics.events force row level security;

create policy "service_role_only"
	on analytics.events
	for all
	using (false);


-- ############################################################################
-- PART 3: DB-LEVEL CHECK CONSTRAINTS (defense-in-depth)
-- ############################################################################
-- The DTO layer validates event_name format and properties size, but direct
-- service_role inserts (backfill scripts, manual operations) bypass DTOs.

-- event_name: must match the DTO regex ^[a-z][a-z0-9_]*$
-- Uses a CHECK on the parent table; pg_partman propagates to new partitions.
alter table analytics.events
	add constraint chk_events_event_name
	check (event_name ~ '^[a-z][a-z0-9_]*$');

-- properties: max ~16KB (safety net above the API's 10KB limit)
alter table analytics.events
	add constraint chk_events_properties_size
	check (octet_length(properties::text) <= 16384);
