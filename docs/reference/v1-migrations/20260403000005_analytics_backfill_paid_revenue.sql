-- ============================================================================
-- Migration: analytics_backfill_paid_revenue
-- Description: Re-runs backfill_company_stats for all companies to correct
--              paid_revenue values. Previously, manual payment confirmations
--              (ORDER_PAYMENT_CHANGED → paid) were not tracked, so paid_revenue
--              was only populated from gateway-confirmed payments.
-- Dependencies: 20260402000001_analytics_schema (backfill function)
-- ============================================================================

do $$
declare
	r record;
begin
	for r in select id from public.companies loop
		perform analytics.backfill_company_stats(r.id);
		raise notice 'Backfilled analytics for company %', r.id;
	end loop;
end;
$$;
