-- ============================================================================
-- Migration: fix_analytics_anonymous_access
-- Description: Adds NOT is_anonymous_user() guard to the three analytics
--              daily-stats table policies and the get_checkout_payment_info
--              RPC. These were created after 20260401000003 and missed the
--              anonymous-access hardening applied to all other tables.
-- Dependencies: analytics_schema (20260402000001),
--               company_legal_info (20260320000004)
-- ============================================================================

BEGIN;

-- ############################################################################
-- PART 1: ANALYTICS DAILY STATS POLICIES
-- ############################################################################

-- company_daily_stats
drop policy if exists "company_daily_stats: member select"
	on analytics.company_daily_stats;
create policy "company_daily_stats: member select"
	on analytics.company_daily_stats
	for select
	to authenticated
	using (
		not is_anonymous_user()
		and has_company_permission(company_id, 'analytics:view', (select auth.uid()))
	);

-- company_product_daily_stats
drop policy if exists "company_product_daily_stats: member select"
	on analytics.company_product_daily_stats;
create policy "company_product_daily_stats: member select"
	on analytics.company_product_daily_stats
	for select
	to authenticated
	using (
		not is_anonymous_user()
		and has_company_permission(company_id, 'analytics:view', (select auth.uid()))
	);

-- company_customer_daily_stats
drop policy if exists "company_customer_daily_stats: member select"
	on analytics.company_customer_daily_stats;
create policy "company_customer_daily_stats: member select"
	on analytics.company_customer_daily_stats
	for select
	to authenticated
	using (
		not is_anonymous_user()
		and has_company_permission(company_id, 'analytics:view', (select auth.uid()))
	);


-- ############################################################################
-- PART 2: HARDEN get_checkout_payment_info RPC
-- ############################################################################
-- Anonymous users cannot complete checkout (cart/checkout policies block them),
-- so they should not access company banking details either.

drop function if exists get_checkout_payment_info(uuid);

create or replace function get_checkout_payment_info(p_company_id uuid)
returns table (
	enabled_methods text[],
	legal_name      text,
	edrpou          text,
	iban            text,
	bank_name       text,
	bank_mfo        text,
	bank_edrpou     text,
	bank_notes      text,
	bank_reference_template text
)
security definer
stable
language sql
set search_path = ''
as $$
	select
		ps.enabled_methods,
		cli.legal_name,
		cli.edrpou,
		cli.iban,
		cli.bank_name,
		cli.bank_mfo,
		cli.bank_edrpou,
		ps.bank_notes,
		ps.bank_reference_template
	from public.payment_settings ps
	left join public.company_legal_info cli on cli.company_id = ps.company_id
	where ps.company_id = p_company_id
	  and not public.is_anonymous_user();
$$;

comment on function get_checkout_payment_info(uuid) is
	'Returns checkout-relevant payment + legal info for a company (joins company_legal_info for bank details). Rejects anonymous callers.';

COMMIT;
