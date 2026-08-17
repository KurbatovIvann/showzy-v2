-- ============================================================================
-- Migration: analytics_unique_visitors
-- Description: Adds uniqueVisitors (COUNT DISTINCT session_id for
--              showcase_viewed) to the dashboard summary RPC so the
--              frontend can display unique visitor count and conversion rate.
-- Dependencies: 20260403000001_analytics_dashboard_rpcs
-- ============================================================================

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
					'completedSessions', count(distinct e.session_id) filter (where e.event_name = 'checkout_completed'),
					'uniqueVisitors',    count(distinct e.session_id) filter (where e.event_name = 'showcase_viewed')
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
					'completedSessions', count(distinct e.session_id) filter (where e.event_name = 'checkout_completed'),
					'uniqueVisitors',    count(distinct e.session_id) filter (where e.event_name = 'showcase_viewed')
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
	'Composite dashboard RPC: returns commerce + behavioral KPIs (including uniqueVisitors) for current and previous period';
