-- ============================================================================
-- Migration: analytics_cursor_pagination
-- Description: Cursor-based paginated RPCs for products, customers, and
--              searches drill-down pages. Ordered by revenue/spent/count DESC
--              with ID/query as tie-breaker for stable pagination.
-- Dependencies: 20260402000001, 20260403000002
-- ============================================================================


-- ############################################################################
-- PART 1: PAGINATED PRODUCTS (cursor by revenue DESC, product_id tie-break)
-- ############################################################################

create or replace function analytics_list_products(
	p_company_id   uuid,
	p_from         date,
	p_to           date,
	p_limit        int     default 20,
	p_cursor_value numeric default null,
	p_cursor_id    uuid    default null
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
set statement_timeout = '15s'
as $$
	select
		s.product_id,
		coalesce(sum(s.order_count), 0)::bigint,
		coalesce(sum(s.quantity_sold), 0)::bigint,
		coalesce(sum(s.revenue), 0) as revenue
	from analytics.company_product_daily_stats s
	where s.company_id = p_company_id
	  and s.date between p_from and p_to
	group by s.product_id
	having (
		p_cursor_value is null
		or coalesce(sum(s.revenue), 0) < p_cursor_value
		or (coalesce(sum(s.revenue), 0) = p_cursor_value and s.product_id > p_cursor_id)
	)
	order by revenue desc, s.product_id asc
	limit least(p_limit, 50);
$$;

revoke execute on function public.analytics_list_products(uuid, date, date, int, numeric, uuid)
	from public, anon, authenticated;
grant execute on function public.analytics_list_products(uuid, date, date, int, numeric, uuid)
	to service_role;


-- ############################################################################
-- PART 2: PAGINATED CUSTOMERS (cursor by total_spent DESC, customer_id tie-break)
-- ############################################################################

create or replace function analytics_list_customers(
	p_company_id   uuid,
	p_from         date,
	p_to           date,
	p_limit        int     default 20,
	p_cursor_value numeric default null,
	p_cursor_id    uuid    default null
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
set statement_timeout = '15s'
as $$
	select
		s.customer_id,
		coalesce(sum(s.order_count), 0)::bigint,
		coalesce(sum(s.total_spent), 0) as total_spent
	from analytics.company_customer_daily_stats s
	where s.company_id = p_company_id
	  and s.date between p_from and p_to
	group by s.customer_id
	having (
		p_cursor_value is null
		or coalesce(sum(s.total_spent), 0) < p_cursor_value
		or (coalesce(sum(s.total_spent), 0) = p_cursor_value and s.customer_id > p_cursor_id)
	)
	order by total_spent desc, s.customer_id asc
	limit least(p_limit, 50);
$$;

revoke execute on function public.analytics_list_customers(uuid, date, date, int, numeric, uuid)
	from public, anon, authenticated;
grant execute on function public.analytics_list_customers(uuid, date, date, int, numeric, uuid)
	to service_role;


-- ############################################################################
-- PART 3: PAGINATED SEARCHES (cursor by count DESC, query text tie-break)
-- ############################################################################

create or replace function analytics_list_searches(
	p_company_id   uuid,
	p_from         date,
	p_to           date,
	p_limit        int     default 20,
	p_cursor_value bigint  default null,
	p_cursor_id    text    default null
)
returns table (
	query        text,
	search_count bigint
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
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
	having (
		p_cursor_value is null
		or count(*) < p_cursor_value
		or (count(*) = p_cursor_value and e.properties->>'query' > p_cursor_id)
	)
	order by search_count desc, query asc
	limit least(p_limit, 50);
$$;

revoke execute on function public.analytics_list_searches(uuid, date, date, int, bigint, text)
	from public, anon, authenticated;
grant execute on function public.analytics_list_searches(uuid, date, date, int, bigint, text)
	to service_role;
