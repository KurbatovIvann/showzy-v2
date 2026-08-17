-- ============================================================================
-- Migration: analytics_dashboard_rpcs
-- Description: Composite dashboard RPCs for efficient two-tier dashboard loading.
--              analytics_get_dashboard_summary returns commerce + behavioral KPIs
--              for both current and previous period in a single DB round trip.
--              analytics_get_top_searches aggregates search event query terms.
-- Dependencies: 20260402000001_analytics_schema,
--               20260402000002_analytics_aggregation_rpcs,
--               20260402000005_analytics_security_hardening
-- ============================================================================


-- ############################################################################
-- PART 1: PERFORMANCE INDEX
-- ############################################################################

-- Composite index for behavioral event aggregation: company + event type + time.
-- The dashboard summary filters by company_id, event_name IN (...), and
-- created_at range. This index lets Postgres seek directly to the relevant
-- event types within a company, then range scan on time.
-- Partition pruning handles the date dimension first, then this index kicks in.

create index if not exists idx_events_company_event_created
	on analytics.events (company_id, event_name, created_at);


-- ############################################################################
-- PART 2: COMPOSITE DASHBOARD SUMMARY RPC
-- ############################################################################

-- Returns a single JSON object containing commerce and behavioral stats
-- for both the requested period and the previous period of equal length.
-- Previous period is auto-calculated as: (p_from - period_length - 1) to (p_from - 1).
--
-- Commerce stats come from the pre-aggregated company_daily_stats table.
-- Behavioral stats come from the partitioned analytics.events table using
-- COUNT(*) for views and COUNT(DISTINCT session_id) for funnel metrics.
--
-- Response rate is intentionally excluded — it queries public.messages with
-- complex CTE logic (first customer msg → first reply → response time) and
-- is better served by the existing analytics_get_response_rate_stats RPC
-- called in parallel from the NestJS service layer.

create or replace function analytics_get_dashboard_summary(
	p_company_id uuid,
	p_from       date,
	p_to         date
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_prev_from date;
	v_prev_to   date;
	v_result    json;
begin
	-- Previous period: same length window ending the day before p_from
	v_prev_to   := p_from - 1;
	v_prev_from := v_prev_to - (p_to - p_from);

	select json_build_object(
		'current', json_build_object(
			'commerce', (
				select json_build_object(
					'orderCount',   coalesce(sum(s.order_count), 0),
					'totalRevenue', coalesce(sum(s.total_revenue), 0),
					'paidRevenue',  coalesce(sum(s.paid_revenue), 0),
					'newCustomers', coalesce(sum(s.new_customers), 0)
				)
				from analytics.company_daily_stats s
				where s.company_id = p_company_id
				  and s.date between p_from and p_to
			),
			'behavior', (
				select json_build_object(
					'showcaseViews',     count(*) filter (where e.event_name = 'showcase_viewed'),
					'productViews',      count(*) filter (where e.event_name = 'product_viewed'),
					'browseNavigations', count(*) filter (where e.event_name = 'showcase_opened_from_browse'),
					'searches',          count(*) filter (where e.event_name = 'search_performed'),
					'cartSessions',      count(distinct e.session_id) filter (where e.event_name = 'cart_item_added'),
					'checkoutSessions',  count(distinct e.session_id) filter (where e.event_name = 'checkout_started'),
					'completedSessions', count(distinct e.session_id) filter (where e.event_name = 'checkout_completed')
				)
				from analytics.events e
				where e.company_id = p_company_id
				  and e.created_at >= p_from::timestamptz
				  and e.created_at <  (p_to + 1)::timestamptz
				  and e.event_name in (
				      'showcase_viewed', 'product_viewed', 'showcase_opened_from_browse',
				      'search_performed', 'cart_item_added', 'checkout_started', 'checkout_completed'
				  )
			)
		),
		'previous', json_build_object(
			'commerce', (
				select json_build_object(
					'orderCount',   coalesce(sum(s.order_count), 0),
					'totalRevenue', coalesce(sum(s.total_revenue), 0),
					'paidRevenue',  coalesce(sum(s.paid_revenue), 0),
					'newCustomers', coalesce(sum(s.new_customers), 0)
				)
				from analytics.company_daily_stats s
				where s.company_id = p_company_id
				  and s.date between v_prev_from and v_prev_to
			),
			'behavior', (
				select json_build_object(
					'showcaseViews',     count(*) filter (where e.event_name = 'showcase_viewed'),
					'productViews',      count(*) filter (where e.event_name = 'product_viewed'),
					'browseNavigations', count(*) filter (where e.event_name = 'showcase_opened_from_browse'),
					'searches',          count(*) filter (where e.event_name = 'search_performed'),
					'cartSessions',      count(distinct e.session_id) filter (where e.event_name = 'cart_item_added'),
					'checkoutSessions',  count(distinct e.session_id) filter (where e.event_name = 'checkout_started'),
					'completedSessions', count(distinct e.session_id) filter (where e.event_name = 'checkout_completed')
				)
				from analytics.events e
				where e.company_id = p_company_id
				  and e.created_at >= v_prev_from::timestamptz
				  and e.created_at <  (v_prev_to + 1)::timestamptz
				  and e.event_name in (
				      'showcase_viewed', 'product_viewed', 'showcase_opened_from_browse',
				      'search_performed', 'cart_item_added', 'checkout_started', 'checkout_completed'
				  )
			)
		)
	) into v_result;

	return v_result;
end;
$$;

comment on function analytics_get_dashboard_summary is
	'Composite dashboard RPC: returns commerce + behavioral KPIs for current and previous period in one call';


-- ############################################################################
-- PART 3: TOP SEARCHES RPC
-- ############################################################################

-- Aggregates search_performed events, extracting the query property from JSONB,
-- grouping by query text, and returning the top N by count.

create or replace function analytics_get_top_searches(
	p_company_id uuid,
	p_from       date,
	p_to         date,
	p_limit      int default 5
)
returns table (
	query        text,
	search_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		e.properties->>'query'  as query,
		count(*)::bigint        as search_count
	from analytics.events e
	where e.company_id = p_company_id
	  and e.event_name = 'search_performed'
	  and e.created_at >= p_from::timestamptz
	  and e.created_at <  (p_to + 1)::timestamptz
	  and e.properties->>'query' is not null
	  and e.properties->>'query' <> ''
	group by e.properties->>'query'
	order by count(*) desc
	limit p_limit;
$$;

comment on function analytics_get_top_searches is
	'Returns top N search queries by frequency for a company within a date range';


-- ############################################################################
-- PART 4: SECURITY — RESTRICT EXECUTION TO service_role
-- ############################################################################

revoke execute on function public.analytics_get_dashboard_summary(uuid, date, date) from public, anon, authenticated;
grant execute on function public.analytics_get_dashboard_summary(uuid, date, date) to service_role;

revoke execute on function public.analytics_get_top_searches(uuid, date, date, int) from public, anon, authenticated;
grant execute on function public.analytics_get_top_searches(uuid, date, date, int) to service_role;
