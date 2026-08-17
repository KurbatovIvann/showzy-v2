-- ============================================================================
-- Migration: orders
-- Description: Order system — sequence, orders table (with idempotency + payment
--              method from day one), order items, order activity logs, order
--              number generation functions, and realtime configuration.
--              Complex RPC functions (create_order_secure, update_order_items_secure,
--              get_order_by_tracking_token) are deferred to a later migration
--              after delivery/payments domains are consolidated.
-- Dependencies: companies, company_customers, company_statuses, products,
--               company_members (is_company_member), core_functions
--               (update_timestamp, obfuscate_seq)
-- Sources: 014_orders (DDL + sequence + simpler functions),
--          015_order_items, 041_secure_order_columns (idempotency_key +
--          payment_method), 056_order_logs, 062_permissions_enforcement (RLS),
--          047/051/052 (realtime)
-- ============================================================================

-- ############################################################################
-- PART 1: SEQUENCE
-- ############################################################################

create sequence order_number_seq
	start with 1
	increment by 1;

-- ############################################################################
-- PART 2: ENUM TYPE
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Type: order_log_action (from 056)
-- Enum for order activity log events.
-- ----------------------------------------------------------------------------

create type order_log_action as enum (
	'order_created',
	'status_changed',
	'payment_changed',
	'delivery_changed',
	'items_changed'
);

comment on type order_log_action is 'Types of order changes that are logged';

-- ############################################################################
-- PART 3: ORDERS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: orders
-- Merged from 014 + 041. Includes idempotency_key and payment_method from
-- day one (were ALTER TABLE additions in 041).
-- Improvement: tracking_token made NOT NULL (always auto-generated).
-- Removed 3 redundant indexes:
--   - idx_orders_tracking_token (covered by UNIQUE constraint)
--   - idx_orders_idempotency_key (covered by UNIQUE constraint)
--   - orders_company_idx (covered by orders_company_payment_status_idx prefix)
-- ----------------------------------------------------------------------------

create table if not exists orders (
	id                   uuid           default gen_random_uuid() primary key,
	company_id           uuid           not null references companies (id) on delete cascade,
	customer_id          uuid           references company_customers (id) on delete set null,
	total_price          numeric(10, 2) not null default 0,
	order_number         text           unique,
	status_id            uuid           references company_statuses (id) on delete set null,
	payment_status       text           not null default 'pending'
		check (payment_status in ('pending', 'paid', 'cancelled', 'refunded')),
	payment_method       text,
	idempotency_key      uuid           unique,
	comment              text,
	customer_name        varchar(255),
	customer_email       varchar(255),
	customer_phone       varchar(50),
	delivery_address     text,
	delivery_city        varchar(100),
	delivery_postal_code varchar(20),
	tracking_token       uuid           default gen_random_uuid() not null unique,
	notes                text,
	created_at           timestamptz    default now(),
	updated_at           timestamptz    default now(),

	constraint orders_customer_contact_check check (
		customer_name is null or (
			customer_email is not null or customer_phone is not null
		)
	)
);

comment on table  orders                      is 'Customer orders for a company';
comment on column orders.customer_name        is 'Customer name at time of order (denormalized for historical accuracy)';
comment on column orders.customer_email       is 'Customer email at time of order';
comment on column orders.customer_phone       is 'Customer phone at time of order';
comment on column orders.delivery_address     is 'Full delivery address';
comment on column orders.delivery_city        is 'Delivery city';
comment on column orders.delivery_postal_code is 'Postal/ZIP code for delivery';
comment on column orders.tracking_token       is 'Unique token for order tracking without authentication';
comment on column orders.notes                is 'Customer notes or special instructions';
comment on column orders.idempotency_key      is 'Unique key to prevent duplicate order creation from retries';
comment on column orders.payment_method       is 'Payment method chosen at checkout';

-- ----------------------------------------------------------------------------
-- Indexes (orders) — 3 kept, 3 removed as redundant
-- ----------------------------------------------------------------------------

create index orders_status_id_idx on orders (status_id);
create index orders_company_payment_status_idx on orders (company_id, payment_status);
create index idx_orders_customer_id on orders (customer_id);
create index idx_orders_customer_email on orders (customer_email);

-- ----------------------------------------------------------------------------
-- RLS (orders) — final state from 062
-- No INSERT policy: orders are created via SECURITY DEFINER functions.
-- ----------------------------------------------------------------------------

alter table orders enable row level security;
alter table orders force row level security;

create policy "orders: member and customer select"
	on orders
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'orders:view', (select auth.uid()))
		or exists (
			select 1 from company_customers cc
			where cc.id = orders.customer_id
			  and cc.user_id = (select auth.uid())
		)
	);

create policy "orders: member update"
	on orders
	for update
	to authenticated
	using (has_company_permission(company_id, 'orders:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'orders:edit', (select auth.uid())));

create policy "orders: member delete"
	on orders
	for delete
	to authenticated
	using (has_company_permission(company_id, 'orders:delete', (select auth.uid())));

-- ############################################################################
-- PART 4: ORDER ITEMS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: order_items
-- From 015. Improvement: added created_at column (original only had
-- updated_at, inconsistent with every other table).
-- ----------------------------------------------------------------------------

create table if not exists order_items (
	id         uuid           default gen_random_uuid() primary key,
	company_id uuid           not null references companies (id) on delete cascade,
	order_id   uuid           not null references orders (id) on delete cascade,
	product_id uuid           not null references products (id) on delete cascade,
	quantity   integer        not null check (quantity > 0),
	price      numeric(10, 2) not null,
	created_at timestamptz    default now(),
	updated_at timestamptz    default now()
);

comment on table  order_items       is 'Line items within an order';
comment on column order_items.price is 'Price at time of order (snapshot, not current product price)';

-- ----------------------------------------------------------------------------
-- Indexes (order_items)
-- ----------------------------------------------------------------------------

create index order_items_order_idx on order_items (order_id);
create index order_items_product_idx on order_items (product_id);

-- ----------------------------------------------------------------------------
-- RLS (order_items) — final state from 062
-- ----------------------------------------------------------------------------

alter table order_items enable row level security;
alter table order_items force row level security;

create policy "order_items: select"
	on order_items
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'orders:view', (select auth.uid()))
		or exists (
			select 1 from orders o
			join company_customers cc on o.customer_id = cc.id
			where o.id = order_items.order_id
			  and cc.user_id = (select auth.uid())
		)
	);

create policy "order_items: member insert"
	on order_items
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'orders:edit', (select auth.uid())));

create policy "order_items: member update"
	on order_items
	for update
	to authenticated
	using (has_company_permission(company_id, 'orders:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'orders:edit', (select auth.uid())));

create policy "order_items: member delete"
	on order_items
	for delete
	to authenticated
	using (has_company_permission(company_id, 'orders:edit', (select auth.uid())));

-- ############################################################################
-- PART 5: ORDER LOGS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: order_logs (from 056)
-- No INSERT policy — logs are created by backend/SECURITY DEFINER functions.
-- ----------------------------------------------------------------------------

create table if not exists order_logs (
	id         uuid             default gen_random_uuid() primary key,
	order_id   uuid             not null references orders (id) on delete cascade,
	company_id uuid             not null references companies (id) on delete cascade,
	action     order_log_action not null,
	old_values jsonb,
	new_values jsonb            not null,
	created_at timestamptz      default now()
);

comment on table  order_logs            is 'Activity log for order events (creation and changes)';
comment on column order_logs.order_id   is 'The order this log entry belongs to';
comment on column order_logs.company_id is 'The company that owns the order (denormalized for RLS)';
comment on column order_logs.action     is 'Type of event that occurred';
comment on column order_logs.old_values is 'Previous values before the change (null for order_created and items_changed)';
comment on column order_logs.new_values is 'New values after the change';
comment on column order_logs.created_at is 'When the change occurred';

-- ----------------------------------------------------------------------------
-- Indexes (order_logs)
-- ----------------------------------------------------------------------------

create index idx_order_logs_order_id on order_logs (order_id, created_at asc);
create index idx_order_logs_company_created on order_logs (company_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS (order_logs) — from 056, untouched by 062
-- ----------------------------------------------------------------------------

alter table order_logs enable row level security;
alter table order_logs force row level security;

create policy "order_logs: select"
	on order_logs
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'orders:view', (select auth.uid()))
		or exists (
			select 1 from orders o
			join company_customers cc on cc.id = o.customer_id
			where o.id = order_logs.order_id
			  and cc.user_id = (select auth.uid())
		)
	);

-- ############################################################################
-- PART 6: FUNCTIONS (simpler ones — complex RPCs deferred)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: generate_order_number (from 014)
-- Generates unique order number using company prefix + obfuscated sequence.
-- Format: PREFIX-OBFUSCATED (e.g., MON-K7X2)
-- ----------------------------------------------------------------------------

create or replace function generate_order_number(p_company_id uuid)
	returns text
	set search_path = ''
as $$
declare
	prefix     text;
	seq_value  bigint;
	obfuscated text;
begin
	select c.prefix
	into prefix
	from public.companies c
	where c.id = p_company_id;

	seq_value := nextval('public.order_number_seq');
	obfuscated := public.obfuscate_seq(seq_value);

	return prefix || '-' || obfuscated;
end;
$$ language plpgsql;

comment on function generate_order_number(uuid) is
	'Generates unique order number with company prefix and obfuscated sequence';

-- ----------------------------------------------------------------------------
-- Function: set_order_number (from 014)
-- Trigger function that auto-generates order_number on INSERT if not provided.
-- Allows create_order_secure to pre-generate while still auto-generating for
-- manual/panel inserts.
-- ----------------------------------------------------------------------------

create or replace function set_order_number()
	returns trigger
	set search_path = ''
as $$
begin
	if new.order_number is null then
		new.order_number := public.generate_order_number(new.company_id);
	end if;
	return new;
end;
$$ language plpgsql;

-- ############################################################################
-- PART 7: TRIGGERS
-- ############################################################################

create trigger orders_update_timestamp
	before update on orders
	for each row
	execute function update_timestamp();

create trigger assign_order_number
	before insert on orders
	for each row
	execute function set_order_number();

create trigger order_items_update_timestamp
	before update on order_items
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 8: REALTIME CONFIGURATION (from 047, 051, 052)
-- ############################################################################

alter table orders replica identity full;
alter table order_items replica identity full;

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;

comment on table orders is
	'Customer orders for a company. Uses REPLICA IDENTITY FULL for complete realtime change tracking.';
