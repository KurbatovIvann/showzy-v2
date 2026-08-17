-- ============================================================================
-- Migration: analytics_schema
-- Description: Analytics foundation — dedicated schema, pre-aggregated summary
--              tables (company daily, product daily, customer daily), partitioned
--              behavioral events table managed by pg_partman, upsert helper
--              functions, RLS policies, and supporting indexes.
-- Dependencies: companies, products, company_customers, company_members
--               (has_company_permission), pg_partman, pg_cron
-- ============================================================================

-- ############################################################################
-- PART 1: SCHEMA & EXTENSIONS
-- ############################################################################

create schema if not exists analytics;

create schema if not exists partman;
create extension if not exists pg_partman with schema partman;

-- ############################################################################
-- PART 2: COMPANY DAILY STATS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: analytics.company_daily_stats
-- One row per company per day. Updated via atomic upserts from event handlers.
-- Composite PK doubles as the primary lookup index (company_id, date).
-- ----------------------------------------------------------------------------

create table analytics.company_daily_stats (
	company_id     uuid           not null references public.companies (id) on delete cascade,
	date           date           not null,
	order_count    int            not null default 0,
	total_revenue  numeric(12, 2) not null default 0,
	paid_revenue   numeric(12, 2) not null default 0,
	new_customers  int            not null default 0,
	messages_received int         not null default 0,
	messages_sent  int            not null default 0,
	updated_at     timestamptz    not null default now(),

	primary key (company_id, date)
);

comment on table analytics.company_daily_stats is 'Pre-aggregated daily overview stats per company';

-- ----------------------------------------------------------------------------
-- RLS (company_daily_stats)
-- Reads via RLS for company members with analytics:view permission.
-- Writes bypass RLS (service role from analytics handler).
-- ----------------------------------------------------------------------------

alter table analytics.company_daily_stats enable row level security;
alter table analytics.company_daily_stats force row level security;

create policy "company_daily_stats: member select"
	on analytics.company_daily_stats
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'analytics:view', (select auth.uid()))
	);

-- ############################################################################
-- PART 3: COMPANY PRODUCT DAILY STATS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: analytics.company_product_daily_stats
-- One row per company × product × day. Tracks per-product order volume and
-- revenue for "top products" dashboards.
-- ----------------------------------------------------------------------------

create table analytics.company_product_daily_stats (
	company_id   uuid           not null references public.companies (id) on delete cascade,
	product_id   uuid           not null references public.products (id) on delete cascade,
	date         date           not null,
	order_count  int            not null default 0,
	quantity_sold int           not null default 0,
	revenue      numeric(12, 2) not null default 0,
	updated_at   timestamptz    not null default now(),

	primary key (company_id, product_id, date)
);

comment on table analytics.company_product_daily_stats is 'Pre-aggregated daily per-product stats for top-products dashboards';

-- ----------------------------------------------------------------------------
-- Indexes (company_product_daily_stats)
-- FK index on product_id for CASCADE deletes (Postgres does not auto-index FKs).
-- Composite index for "top products by revenue" queries.
-- ----------------------------------------------------------------------------

create index idx_cpds_product_id
	on analytics.company_product_daily_stats (product_id);

create index idx_cpds_company_date_revenue
	on analytics.company_product_daily_stats (company_id, date, revenue desc);

-- ----------------------------------------------------------------------------
-- RLS (company_product_daily_stats)
-- ----------------------------------------------------------------------------

alter table analytics.company_product_daily_stats enable row level security;
alter table analytics.company_product_daily_stats force row level security;

create policy "company_product_daily_stats: member select"
	on analytics.company_product_daily_stats
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'analytics:view', (select auth.uid()))
	);

-- ############################################################################
-- PART 4: COMPANY CUSTOMER DAILY STATS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: analytics.company_customer_daily_stats
-- One row per company × customer × day. Tracks per-customer spending for
-- "top customers" dashboards.
-- ----------------------------------------------------------------------------

create table analytics.company_customer_daily_stats (
	company_id   uuid           not null references public.companies (id) on delete cascade,
	customer_id  uuid           not null references public.company_customers (id) on delete cascade,
	date         date           not null,
	order_count  int            not null default 0,
	total_spent  numeric(12, 2) not null default 0,
	updated_at   timestamptz    not null default now(),

	primary key (company_id, customer_id, date)
);

comment on table analytics.company_customer_daily_stats is 'Pre-aggregated daily per-customer stats for top-customers dashboards';

-- ----------------------------------------------------------------------------
-- Indexes (company_customer_daily_stats)
-- FK index on customer_id for CASCADE deletes.
-- Composite index for "top customers by spending" queries.
-- ----------------------------------------------------------------------------

create index idx_ccds_customer_id
	on analytics.company_customer_daily_stats (customer_id);

create index idx_ccds_company_date_spent
	on analytics.company_customer_daily_stats (company_id, date, total_spent desc);

-- ----------------------------------------------------------------------------
-- RLS (company_customer_daily_stats)
-- ----------------------------------------------------------------------------

alter table analytics.company_customer_daily_stats enable row level security;
alter table analytics.company_customer_daily_stats force row level security;

create policy "company_customer_daily_stats: member select"
	on analytics.company_customer_daily_stats
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'analytics:view', (select auth.uid()))
	);

-- ############################################################################
-- PART 5: BEHAVIORAL EVENTS TABLE (PARTITIONED VIA pg_partman)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: analytics.events
-- Append-only behavioral event log. Partitioned by month via pg_partman.
-- The partitioning column (created_at) must be part of the primary key.
-- No RLS — accessed exclusively via service role from the API.
-- ----------------------------------------------------------------------------

create table analytics.events (
	id           bigint       generated always as identity,
	event_name   text         not null,
	company_id   uuid,
	user_id      uuid,
	customer_id  uuid,
	session_id   text,
	properties   jsonb        not null default '{}',
	created_at   timestamptz  not null default now(),

	primary key (created_at, id)
) partition by range (created_at);

comment on table analytics.events is 'Raw behavioral events (page views, product views, searches). Partitioned monthly by pg_partman.';

-- ----------------------------------------------------------------------------
-- Indexes (events)
-- Created on the parent — pg_partman propagates to each partition.
-- ----------------------------------------------------------------------------

create index idx_events_company_created
	on analytics.events (company_id, created_at);

create index idx_events_name
	on analytics.events (event_name);

-- ----------------------------------------------------------------------------
-- pg_partman configuration: monthly partitions, pre-create 3 months ahead
-- ----------------------------------------------------------------------------

select partman.create_parent(
	p_parent_table   := 'analytics.events',
	p_control        := 'created_at',
	p_type           := 'range',
	p_interval       := '1 month',
	p_premake        := 3,
	p_start_partition := now()::date::text
);

-- Schedule hourly maintenance via pg_cron for auto-creating future partitions
select cron.schedule(
	'analytics-partman-maintenance',
	'@hourly',
	$$call partman.run_maintenance_proc()$$
);

-- ############################################################################
-- PART 6: UPSERT HELPER FUNCTIONS
-- ############################################################################

-- Functions live in public schema so Supabase client .rpc() can reach them.
-- Prefixed with analytics_ to avoid naming collisions.
-- SECURITY DEFINER to bypass RLS for service-role writes.

-- ----------------------------------------------------------------------------
-- Function: analytics_upsert_daily_stats
-- Atomically increments company daily stats. Called from the NestJS analytics
-- event handler via supabase.rpc(). Delta-based: add values to existing row
-- or insert a new one.
-- ----------------------------------------------------------------------------

create or replace function analytics_upsert_daily_stats(
	p_company_id         uuid,
	p_date               date,
	p_order_count_delta  int default 0,
	p_revenue_delta      numeric default 0,
	p_paid_revenue_delta numeric default 0,
	p_new_customers_delta int default 0
)
returns void
language sql
security definer
set search_path = ''
as $$
	insert into analytics.company_daily_stats
		(company_id, date, order_count, total_revenue, paid_revenue, new_customers, updated_at)
	values
		(p_company_id, p_date, p_order_count_delta, p_revenue_delta,
		 p_paid_revenue_delta, p_new_customers_delta, now())
	on conflict (company_id, date) do update set
		order_count   = analytics.company_daily_stats.order_count   + excluded.order_count,
		total_revenue = analytics.company_daily_stats.total_revenue + excluded.total_revenue,
		paid_revenue  = analytics.company_daily_stats.paid_revenue  + excluded.paid_revenue,
		new_customers = analytics.company_daily_stats.new_customers + excluded.new_customers,
		updated_at    = now();
$$;

comment on function analytics_upsert_daily_stats is
	'Atomically upserts company daily stats with delta values';

-- ----------------------------------------------------------------------------
-- Function: analytics_upsert_product_daily_stats
-- ----------------------------------------------------------------------------

create or replace function analytics_upsert_product_daily_stats(
	p_company_id        uuid,
	p_product_id        uuid,
	p_date              date,
	p_order_count_delta int default 0,
	p_quantity_delta    int default 0,
	p_revenue_delta     numeric default 0
)
returns void
language sql
security definer
set search_path = ''
as $$
	insert into analytics.company_product_daily_stats
		(company_id, product_id, date, order_count, quantity_sold, revenue, updated_at)
	values
		(p_company_id, p_product_id, p_date, p_order_count_delta,
		 p_quantity_delta, p_revenue_delta, now())
	on conflict (company_id, product_id, date) do update set
		order_count   = analytics.company_product_daily_stats.order_count   + excluded.order_count,
		quantity_sold = analytics.company_product_daily_stats.quantity_sold + excluded.quantity_sold,
		revenue       = analytics.company_product_daily_stats.revenue       + excluded.revenue,
		updated_at    = now();
$$;

comment on function analytics_upsert_product_daily_stats is
	'Atomically upserts per-product daily stats with delta values';

-- ----------------------------------------------------------------------------
-- Function: analytics_upsert_customer_daily_stats
-- ----------------------------------------------------------------------------

create or replace function analytics_upsert_customer_daily_stats(
	p_company_id        uuid,
	p_customer_id       uuid,
	p_date              date,
	p_order_count_delta int default 0,
	p_spent_delta       numeric default 0
)
returns void
language sql
security definer
set search_path = ''
as $$
	insert into analytics.company_customer_daily_stats
		(company_id, customer_id, date, order_count, total_spent, updated_at)
	values
		(p_company_id, p_customer_id, p_date, p_order_count_delta,
		 p_spent_delta, now())
	on conflict (company_id, customer_id, date) do update set
		order_count = analytics.company_customer_daily_stats.order_count + excluded.order_count,
		total_spent = analytics.company_customer_daily_stats.total_spent + excluded.total_spent,
		updated_at  = now();
$$;

comment on function analytics_upsert_customer_daily_stats is
	'Atomically upserts per-customer daily stats with delta values';

-- ############################################################################
-- PART 7: BACKFILL FUNCTION
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: analytics.backfill_company_stats
-- Computes historical summaries from orders + order_items for a single company.
-- Designed to be called per-company to keep transactions short.
-- ----------------------------------------------------------------------------

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
	-- Daily stats from orders
	insert into analytics.company_daily_stats
		(company_id, date, order_count, total_revenue, paid_revenue)
	select
		o.company_id,
		o.created_at::date,
		count(*)::int,
		coalesce(sum(o.total_price), 0),
		coalesce(sum(case when o.payment_status = 'paid' then o.total_price else 0 end), 0)
	from public.orders o
	where o.company_id = p_company_id
	  and o.created_at::date between p_from_date and p_to_date
	group by o.company_id, o.created_at::date
	on conflict (company_id, date) do update set
		order_count   = excluded.order_count,
		total_revenue = excluded.total_revenue,
		paid_revenue  = excluded.paid_revenue,
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
	'Computes historical analytics summaries for a single company from orders + order_items';

-- ############################################################################
-- PART 8: RUN BACKFILL FOR ALL EXISTING COMPANIES
-- ############################################################################

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
