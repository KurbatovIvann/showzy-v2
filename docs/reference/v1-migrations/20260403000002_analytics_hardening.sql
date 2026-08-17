-- ============================================================================
-- Migration: analytics_hardening
-- Description: Performance and defense-in-depth improvements for analytics RPCs.
--   1. Expression index for top-searches JSONB extraction
--   2. Revenue chart RPC with SQL-side granularity bucketing
--   3. Statement timeout on all analytics RPCs (15s safety net)
--   4. LEAST() limit clamping on top-N RPCs
-- Dependencies: 20260402000001, 20260402000002, 20260402000004,
--               20260403000001
-- ============================================================================


-- ############################################################################
-- PART 1: EXPRESSION INDEX FOR TOP SEARCHES
-- ############################################################################

-- The analytics_get_top_searches RPC extracts properties->>'query' and groups
-- by it. Without this index Postgres must decompress the JSONB column for every
-- matching row. The partial filter avoids indexing events we never query.

create index if not exists idx_events_search_query
	on analytics.events ((properties->>'query'))
	where event_name = 'search_performed'
	  and properties->>'query' is not null;


-- ############################################################################
-- PART 2: REVENUE CHART RPC
-- ############################################################################

-- Server-side bucketing via date_trunc replaces JS-side bucketing and the
-- raw PostgREST query builder. Accepts 'day', 'week', or 'month' granularity.

create or replace function analytics_get_revenue_chart(
	p_company_id  uuid,
	p_from        date,
	p_to          date,
	p_granularity text default 'day'
)
returns table (
	date          date,
	total_revenue numeric,
	order_count   bigint
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
	select
		case p_granularity
			when 'week'  then date_trunc('week', s.date)::date
			when 'month' then date_trunc('month', s.date)::date
			else s.date
		end                              as date,
		coalesce(sum(s.total_revenue), 0) as total_revenue,
		coalesce(sum(s.order_count), 0)::bigint as order_count
	from analytics.company_daily_stats s
	where s.company_id = p_company_id
	  and s.date between p_from and p_to
	group by 1
	order by 1;
$$;

comment on function analytics_get_revenue_chart is
	'Returns revenue chart data bucketed by day/week/month for a company within a date range';

revoke execute on function public.analytics_get_revenue_chart(uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.analytics_get_revenue_chart(uuid, date, date, text) to service_role;


-- ############################################################################
-- PART 3: STATEMENT TIMEOUT ON EXISTING ANALYTICS RPCs
-- ############################################################################

-- Adding SET statement_timeout = '15s' to all analytics functions as a safety
-- net against runaway queries on wide date ranges. Each SET only affects the
-- function's own execution context (SECURITY DEFINER scope).

-- analytics_get_period_stats
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
set statement_timeout = '15s'
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

-- analytics_get_top_products (+ LEAST limit clamp)
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
set statement_timeout = '15s'
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
	limit least(p_limit, 50);
$$;

-- analytics_get_top_customers (+ LEAST limit clamp)
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
set statement_timeout = '15s'
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
	limit least(p_limit, 50);
$$;

-- analytics_get_response_rate_stats
create or replace function analytics_get_response_rate_stats(
	p_company_id uuid,
	p_from       date,
	p_to         date
)
returns table (
	total_conversations     bigint,
	responded_conversations bigint,
	response_rate           numeric,
	avg_response_time_sec   numeric,
	median_response_time_sec numeric
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
	with first_customer_msg as (
		select distinct on (m.conversation_id)
			m.conversation_id,
			m.created_at as customer_msg_at
		from public.messages m
		where m.company_id = p_company_id
		  and m.sender_type in ('customer', 'external_contact')
		  and m.created_at >= p_from::timestamptz
		  and m.created_at <  (p_to + interval '1 day')::timestamptz
		  and m.deleted_at is null
		order by m.conversation_id, m.created_at asc
	),
	first_reply as (
		select
			fcm.conversation_id,
			min(r.created_at) as reply_at
		from first_customer_msg fcm
		join public.messages r
		  on r.conversation_id = fcm.conversation_id
		 and r.company_id = p_company_id
		 and r.sender_type = 'company_member'
		 and r.created_at > fcm.customer_msg_at
		 and r.deleted_at is null
		group by fcm.conversation_id
	),
	response_times as (
		select
			extract(epoch from (fr.reply_at - fcm.customer_msg_at)) as seconds
		from first_customer_msg fcm
		join first_reply fr on fr.conversation_id = fcm.conversation_id
	)
	select
		(select count(*) from first_customer_msg)::bigint as total_conversations,
		(select count(*) from first_reply)::bigint        as responded_conversations,
		case
			when (select count(*) from first_customer_msg) = 0 then 0
			else round(
				(select count(*) from first_reply)::numeric
				/ (select count(*) from first_customer_msg) * 100, 2
			)
		end as response_rate,
		(select round(avg(seconds)::numeric, 0) from response_times)  as avg_response_time_sec,
		(select round(
			percentile_cont(0.5) within group (order by seconds)::numeric, 0
		) from response_times) as median_response_time_sec;
$$;

-- analytics_get_response_rate_chart
create or replace function analytics_get_response_rate_chart(
	p_company_id uuid,
	p_from       date,
	p_to         date
)
returns table (
	date                    date,
	conversation_count      bigint,
	responded_count         bigint,
	response_rate           numeric,
	avg_response_time_sec   numeric
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
	with first_customer_msg as (
		select distinct on (m.conversation_id)
			m.conversation_id,
			m.created_at::date as msg_date,
			m.created_at       as customer_msg_at
		from public.messages m
		where m.company_id = p_company_id
		  and m.sender_type in ('customer', 'external_contact')
		  and m.created_at >= p_from::timestamptz
		  and m.created_at <  (p_to + interval '1 day')::timestamptz
		  and m.deleted_at is null
		order by m.conversation_id, m.created_at asc
	),
	first_reply as (
		select
			fcm.conversation_id,
			min(r.created_at) as reply_at,
			extract(epoch from (min(r.created_at) - fcm.customer_msg_at)) as seconds
		from first_customer_msg fcm
		join public.messages r
		  on r.conversation_id = fcm.conversation_id
		 and r.company_id = p_company_id
		 and r.sender_type = 'company_member'
		 and r.created_at > fcm.customer_msg_at
		 and r.deleted_at is null
		group by fcm.conversation_id, fcm.customer_msg_at
	)
	select
		fcm.msg_date as date,
		count(*)::bigint                              as conversation_count,
		count(fr.conversation_id)::bigint             as responded_count,
		case
			when count(*) = 0 then 0
			else round(
				count(fr.conversation_id)::numeric
				/ count(*) * 100, 2
			)
		end as response_rate,
		round(avg(fr.seconds)::numeric, 0)            as avg_response_time_sec
	from first_customer_msg fcm
	left join first_reply fr
	  on fr.conversation_id = fcm.conversation_id
	group by fcm.msg_date
	order by fcm.msg_date;
$$;

-- analytics_get_dashboard_summary
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
set statement_timeout = '15s'
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

-- analytics_get_top_searches (+ LEAST limit clamp + statement_timeout)
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
	order by count(*) desc
	limit least(p_limit, 50);
$$;
