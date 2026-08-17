-- ============================================================================
-- Migration: analytics_aggregation_rpcs
-- Description: Server-side aggregation RPCs for analytics dashboard queries.
--              Moves GROUP BY / SUM / ORDER BY / LIMIT logic from JS to SQL
--              for top-products, top-customers, and period-stats endpoints.
-- Dependencies: analytics schema tables from 20260402000001_analytics_schema
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: analytics_get_period_stats
-- Aggregates company_daily_stats for a date range into a single summary row.
-- Called by the NestJS analytics service for the overview endpoint.
-- ----------------------------------------------------------------------------

create or replace function analytics_get_period_stats(
	p_company_id uuid,
	p_from       date,
	p_to         date
)
returns table (
	order_count   bigint,
	total_revenue numeric,
	paid_revenue  numeric,
	new_customers bigint
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		coalesce(sum(s.order_count), 0)::bigint,
		coalesce(sum(s.total_revenue), 0),
		coalesce(sum(s.paid_revenue), 0),
		coalesce(sum(s.new_customers), 0)::bigint
	from analytics.company_daily_stats s
	where s.company_id = p_company_id
	  and s.date between p_from and p_to;
$$;

comment on function analytics_get_period_stats is
	'Aggregates company daily stats for a date range into a single summary row';

-- ----------------------------------------------------------------------------
-- Function: analytics_get_top_products
-- Aggregates product daily stats, groups by product, orders by revenue DESC,
-- and limits to N results. Replaces in-memory JS aggregation.
-- ----------------------------------------------------------------------------

create or replace function analytics_get_top_products(
	p_company_id uuid,
	p_from       date,
	p_to         date,
	p_limit      int default 10
)
returns table (
	product_id    uuid,
	order_count   bigint,
	quantity_sold bigint,
	revenue       numeric
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		s.product_id,
		coalesce(sum(s.order_count), 0)::bigint,
		coalesce(sum(s.quantity_sold), 0)::bigint,
		coalesce(sum(s.revenue), 0)
	from analytics.company_product_daily_stats s
	where s.company_id = p_company_id
	  and s.date between p_from and p_to
	group by s.product_id
	order by coalesce(sum(s.revenue), 0) desc
	limit p_limit;
$$;

comment on function analytics_get_top_products is
	'Returns top N products by revenue for a company within a date range';

-- ----------------------------------------------------------------------------
-- Function: analytics_get_top_customers
-- Aggregates customer daily stats, groups by customer, orders by spending DESC,
-- and limits to N results. Replaces in-memory JS aggregation.
-- ----------------------------------------------------------------------------

create or replace function analytics_get_top_customers(
	p_company_id uuid,
	p_from       date,
	p_to         date,
	p_limit      int default 10
)
returns table (
	customer_id  uuid,
	order_count  bigint,
	total_spent  numeric
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		s.customer_id,
		coalesce(sum(s.order_count), 0)::bigint,
		coalesce(sum(s.total_spent), 0)
	from analytics.company_customer_daily_stats s
	where s.company_id = p_company_id
	  and s.date between p_from and p_to
	group by s.customer_id
	order by coalesce(sum(s.total_spent), 0) desc
	limit p_limit;
$$;

comment on function analytics_get_top_customers is
	'Returns top N customers by spending for a company within a date range';
