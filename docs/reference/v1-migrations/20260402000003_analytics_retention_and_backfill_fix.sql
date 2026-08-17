-- ============================================================================
-- Migration: analytics_retention_and_backfill_fix
-- Description: Adds partition retention for analytics.events (12 months),
--              fixes backfill to compute new_customers, and drops unused
--              messages_received/messages_sent columns from company_daily_stats.
-- Dependencies: 20260402000001_analytics_schema
-- ============================================================================

-- ############################################################################
-- PART 1: PARTITION RETENTION (12 months)
-- ############################################################################

update partman.part_config
set retention          = '12 months',
    retention_keep_table = false
where parent_table = 'analytics.events';

-- ############################################################################
-- PART 2: DROP UNUSED COLUMNS
-- ############################################################################

alter table analytics.company_daily_stats
	drop column if exists messages_received,
	drop column if exists messages_sent;

-- ############################################################################
-- PART 3: FIX BACKFILL TO COMPUTE new_customers
-- ############################################################################

create or replace function analytics.backfill_company_stats(
	p_company_id uuid,
	p_from_date  date default '2025-01-01',
	p_to_date    date default current_date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	-- Daily stats from orders (including new_customers from first-order dates)
	insert into analytics.company_daily_stats
		(company_id, date, order_count, total_revenue, paid_revenue, new_customers)
	select
		o.company_id,
		o.created_at::date,
		count(*)::int,
		coalesce(sum(o.total_price), 0),
		coalesce(sum(case when o.payment_status = 'paid' then o.total_price else 0 end), 0),
		coalesce(nc.new_count, 0)::int
	from public.orders o
	left join (
		select
			first_orders.company_id,
			first_orders.first_date as date,
			count(*)::int as new_count
		from (
			select
				company_id,
				customer_id,
				min(created_at)::date as first_date
			from public.orders
			where customer_id is not null
			  and company_id = p_company_id
			  and created_at::date between p_from_date and p_to_date
			group by company_id, customer_id
		) first_orders
		group by first_orders.company_id, first_orders.first_date
	) nc on nc.company_id = o.company_id and nc.date = o.created_at::date
	where o.company_id = p_company_id
	  and o.created_at::date between p_from_date and p_to_date
	group by o.company_id, o.created_at::date, nc.new_count
	on conflict (company_id, date) do update set
		order_count   = excluded.order_count,
		total_revenue = excluded.total_revenue,
		paid_revenue  = excluded.paid_revenue,
		new_customers = excluded.new_customers,
		updated_at    = now();

	-- Product daily stats from order_items
	insert into analytics.company_product_daily_stats
		(company_id, product_id, date, order_count, quantity_sold, revenue)
	select
		oi.company_id,
		oi.product_id,
		o.created_at::date,
		count(distinct o.id)::int,
		coalesce(sum(oi.quantity), 0)::int,
		coalesce(sum(oi.price * oi.quantity), 0)
	from public.order_items oi
	join public.orders o on o.id = oi.order_id
	where oi.company_id = p_company_id
	  and o.created_at::date between p_from_date and p_to_date
	group by oi.company_id, oi.product_id, o.created_at::date
	on conflict (company_id, product_id, date) do update set
		order_count   = excluded.order_count,
		quantity_sold = excluded.quantity_sold,
		revenue       = excluded.revenue,
		updated_at    = now();

	-- Customer daily stats from orders
	insert into analytics.company_customer_daily_stats
		(company_id, customer_id, date, order_count, total_spent)
	select
		o.company_id,
		o.customer_id,
		o.created_at::date,
		count(*)::int,
		coalesce(sum(o.total_price), 0)
	from public.orders o
	where o.company_id = p_company_id
	  and o.customer_id is not null
	  and o.created_at::date between p_from_date and p_to_date
	group by o.company_id, o.customer_id, o.created_at::date
	on conflict (company_id, customer_id, date) do update set
		order_count = excluded.order_count,
		total_spent = excluded.total_spent,
		updated_at  = now();
end;
$$;

comment on function analytics.backfill_company_stats is
	'Computes historical analytics summaries for a single company from orders + order_items (includes new_customers)';
