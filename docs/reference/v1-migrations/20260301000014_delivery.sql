-- ============================================================================
-- Migration: delivery
-- Description: Delivery system — enum types, provider city/warehouse/street
--              reference data, company delivery method configuration, order
--              delivery records with lifecycle tracking, and provider sync
--              functions. Realtime config for order_deliveries.
-- Dependencies: companies, orders, company_customers, company_members
--               (is_company_member), core_functions (update_timestamp)
-- Sources: 038_delivery_system (enums, delivery_cities, company_delivery_methods,
--          order_deliveries, upsert_delivery_city),
--          039_delivery_warehouses (delivery_warehouses, delivery_streets,
--          warehouse/street functions),
--          079_delivery_cities_coords (city lat/lng + updated upsert),
--          097_delivery_streets_coords (street lat/lng + updated upsert/get),
--          052_orders_replica_identity (order_deliveries realtime)
-- ============================================================================

-- ############################################################################
-- PART 1: ENUM TYPES
-- ############################################################################

create type delivery_method_type as enum (
	'pickup',
	'city_delivery',
	'nova_poshta',
	'meest'
);

create type delivery_sub_type as enum (
	'warehouse',
	'poshtomat',
	'courier'
);

create type delivery_status as enum (
	'pending',
	'processing',
	'shipped',
	'in_transit',
	'delivered',
	'returned',
	'cancelled'
);

-- ############################################################################
-- PART 2: DELIVERY CITIES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: delivery_cities
-- From 038 + 079. Includes latitude/longitude from day one (were ALTER TABLE
-- additions in 079).
-- ----------------------------------------------------------------------------

create table if not exists delivery_cities (
	id              uuid             default gen_random_uuid() primary key,
	provider        text             not null check (provider in ('nova_poshta', 'meest')),
	city_ref        text             not null,
	settlement_ref  text,
	name_uk         text             not null,
	name_en         text,
	area_uk         text,
	area_en         text,
	region_uk       text,
	region_en       text,
	settlement_type text,
	is_popular      boolean          default false,
	latitude        double precision,
	longitude       double precision,
	created_at      timestamptz      default now(),
	updated_at      timestamptz      default now(),

	unique (provider, city_ref)
);

comment on table  delivery_cities                is 'Synced cities from delivery providers (Nova Post, Meest)';
comment on column delivery_cities.provider       is 'Delivery provider: nova_poshta, meest';
comment on column delivery_cities.city_ref       is 'Provider-specific city reference ID';
comment on column delivery_cities.settlement_ref is 'Settlement ref from getSettlements API (may differ from city_ref)';
comment on column delivery_cities.is_popular     is 'Popular city for quick select buttons (Kyiv, Odesa, etc.)';
comment on column delivery_cities.latitude       is 'City latitude from provider API';
comment on column delivery_cities.longitude      is 'City longitude from provider API';

-- ----------------------------------------------------------------------------
-- Indexes (delivery_cities) — 3 kept, 1 removed as redundant
-- Removed: idx_delivery_cities_provider — covered by unique constraint
--          (provider, city_ref) prefix.
-- ----------------------------------------------------------------------------

create index idx_delivery_cities_name_uk on delivery_cities (name_uk);
create index idx_delivery_cities_settlement_ref on delivery_cities (provider, settlement_ref);
create index idx_delivery_cities_popular on delivery_cities (provider, is_popular) where is_popular = true;

-- ----------------------------------------------------------------------------
-- RLS (delivery_cities) — public read only (reference data)
-- ----------------------------------------------------------------------------

alter table delivery_cities enable row level security;
alter table delivery_cities force row level security;

create policy "delivery_cities: public select"
	on delivery_cities
	for select
	using (true);

-- ----------------------------------------------------------------------------
-- Trigger (delivery_cities)
-- ----------------------------------------------------------------------------

create trigger delivery_cities_update_timestamp
	before update on delivery_cities
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: DELIVERY WAREHOUSES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: delivery_warehouses (from 039)
-- Synced provider warehouses and poshtomats.
-- ----------------------------------------------------------------------------

create table if not exists delivery_warehouses (
	id              uuid           default gen_random_uuid() primary key,
	provider        text           not null check (provider in ('nova_poshta', 'meest')),
	warehouse_ref   text           not null,
	city_ref        text           not null,
	settlement_ref  text,
	number          text           not null,
	name_uk         text           not null,
	name_en         text,
	short_address   text,
	full_address    text,
	warehouse_type  text           not null check (warehouse_type in ('warehouse', 'poshtomat', 'cargo')),
	latitude        decimal(10, 7),
	longitude       decimal(10, 7),
	phone           text,
	schedule_mon    text,
	schedule_tue    text,
	schedule_wed    text,
	schedule_thu    text,
	schedule_fri    text,
	schedule_sat    text,
	schedule_sun    text,
	max_weight_kg   decimal(10, 2),
	is_active       boolean        default true,
	created_at      timestamptz    default now(),
	updated_at      timestamptz    default now(),

	unique (provider, warehouse_ref)
);

comment on table  delivery_warehouses                is 'Synced warehouses/poshtomats from delivery providers';
comment on column delivery_warehouses.provider       is 'Delivery provider: nova_poshta, meest';
comment on column delivery_warehouses.warehouse_ref  is 'Provider-specific warehouse reference ID';
comment on column delivery_warehouses.warehouse_type is 'Type: warehouse (branch), poshtomat, cargo';
comment on column delivery_warehouses.city_ref       is 'Reference to provider city (delivery_cities.city_ref)';
comment on column delivery_warehouses.settlement_ref is 'Settlement ref from getSettlements API (may differ from city_ref)';

-- ----------------------------------------------------------------------------
-- Indexes (delivery_warehouses) — 4 from 039, unchanged
-- ----------------------------------------------------------------------------

create index idx_delivery_warehouses_city_ref on delivery_warehouses (provider, city_ref);
create index idx_delivery_warehouses_settlement_ref on delivery_warehouses (provider, settlement_ref);
create index idx_delivery_warehouses_type on delivery_warehouses (provider, warehouse_type);
create index idx_delivery_warehouses_number on delivery_warehouses (provider, city_ref, number);

-- ----------------------------------------------------------------------------
-- RLS (delivery_warehouses) — public read only (reference data)
-- Removed unnecessary "service_role full access" policy — service_role
-- bypasses RLS by default in Supabase.
-- ----------------------------------------------------------------------------

alter table delivery_warehouses enable row level security;
alter table delivery_warehouses force row level security;

create policy "delivery_warehouses: public select"
	on delivery_warehouses
	for select
	to anon, authenticated
	using (true);

-- ----------------------------------------------------------------------------
-- Trigger (delivery_warehouses)
-- ----------------------------------------------------------------------------

create trigger update_delivery_warehouses_updated_at
	before update on delivery_warehouses
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 4: DELIVERY STREETS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: delivery_streets
-- From 039 + 097. Includes latitude/longitude from day one (were ALTER TABLE
-- additions in 097).
-- ----------------------------------------------------------------------------

create table if not exists delivery_streets (
	id              uuid             default gen_random_uuid() primary key,
	provider        text             not null check (provider in ('nova_poshta', 'meest')),
	street_ref      text             not null,
	city_ref        text             not null,
	settlement_ref  text,
	name_uk         text             not null,
	name_en         text,
	street_type     text,
	latitude        double precision,
	longitude       double precision,
	created_at      timestamptz      default now(),
	updated_at      timestamptz      default now(),

	unique (provider, street_ref)
);

comment on table  delivery_streets                is 'Synced streets from delivery providers for courier delivery';
comment on column delivery_streets.provider       is 'Delivery provider: nova_poshta, meest';
comment on column delivery_streets.street_ref     is 'Provider-specific street reference ID';
comment on column delivery_streets.city_ref       is 'Reference to provider city';
comment on column delivery_streets.settlement_ref is 'Settlement ref from getSettlements API (may differ from city_ref)';
comment on column delivery_streets.latitude       is 'Street latitude from searchSettlementStreets API';
comment on column delivery_streets.longitude      is 'Street longitude from searchSettlementStreets API';

-- ----------------------------------------------------------------------------
-- Indexes (delivery_streets) — 3 from 039, unchanged
-- ----------------------------------------------------------------------------

create index idx_delivery_streets_city_ref on delivery_streets (provider, city_ref);
create index idx_delivery_streets_settlement_ref on delivery_streets (provider, settlement_ref);
create index idx_delivery_streets_name on delivery_streets (provider, city_ref, name_uk);

-- ----------------------------------------------------------------------------
-- RLS (delivery_streets) — public read only (reference data)
-- Removed unnecessary "service_role full access" policy — service_role
-- bypasses RLS by default in Supabase.
-- ----------------------------------------------------------------------------

alter table delivery_streets enable row level security;
alter table delivery_streets force row level security;

create policy "delivery_streets: public select"
	on delivery_streets
	for select
	to anon, authenticated
	using (true);

-- ----------------------------------------------------------------------------
-- Trigger (delivery_streets)
-- ----------------------------------------------------------------------------

create trigger update_delivery_streets_updated_at
	before update on delivery_streets
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 5: COMPANY DELIVERY METHODS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: company_delivery_methods (from 038)
-- Company's enabled delivery options with JSONB config per method.
-- ----------------------------------------------------------------------------

create table if not exists company_delivery_methods (
	id            uuid                 default gen_random_uuid() primary key,
	company_id    uuid                 not null references companies (id) on delete cascade,
	method        delivery_method_type not null,
	is_enabled    boolean              default true,
	display_order int                  default 0,
	config        jsonb                not null default '{}'::jsonb,
	created_at    timestamptz          default now(),
	updated_at    timestamptz          default now(),

	unique (company_id, method)
);

comment on table  company_delivery_methods               is 'Company delivery method configurations';
comment on column company_delivery_methods.method        is 'Delivery method type';
comment on column company_delivery_methods.config        is 'Method-specific configuration (JSONB). Structure varies by method: pickup has points[], city_delivery has areas[], nova_poshta/meest have allowed_sub_types[]';
comment on column company_delivery_methods.display_order is 'Order in which methods appear in checkout';

-- ----------------------------------------------------------------------------
-- Indexes (company_delivery_methods) — 2 kept, 1 removed as redundant
-- Removed: idx_company_delivery_methods_company — covered by unique
--          constraint (company_id, method) prefix.
-- ----------------------------------------------------------------------------

create index idx_company_delivery_methods_enabled on company_delivery_methods (company_id, is_enabled) where is_enabled = true;
create index idx_company_delivery_methods_config on company_delivery_methods using gin (config);

-- ----------------------------------------------------------------------------
-- RLS (company_delivery_methods) — upgraded to is_company_member
-- ----------------------------------------------------------------------------

alter table company_delivery_methods enable row level security;
alter table company_delivery_methods force row level security;

create policy "company_delivery_methods: anon read enabled"
	on company_delivery_methods
	for select
	to anon
	using (is_enabled = true);

create policy "company_delivery_methods: authenticated select"
	on company_delivery_methods
	for select
	to authenticated
	using (
		is_enabled = true
		or has_company_permission(company_id, 'settings:delivery', (select auth.uid()))
	);

create policy "company_delivery_methods: member insert"
	on company_delivery_methods
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:delivery', (select auth.uid())));

create policy "company_delivery_methods: member update"
	on company_delivery_methods
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:delivery', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:delivery', (select auth.uid())));

create policy "company_delivery_methods: member delete"
	on company_delivery_methods
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:delivery', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (company_delivery_methods)
-- ----------------------------------------------------------------------------

create trigger company_delivery_methods_update_timestamp
	before update on company_delivery_methods
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 6: ORDER DELIVERIES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: order_deliveries (from 038)
-- Delivery record per order with full lifecycle tracking.
-- ----------------------------------------------------------------------------

create table if not exists order_deliveries (
	id                    uuid                 default gen_random_uuid() primary key,
	order_id              uuid                 not null references orders (id) on delete cascade,
	company_id            uuid                 not null references companies (id),
	method                delivery_method_type not null,
	sub_type              delivery_sub_type,
	provider              text,
	city_ref              text,
	city_name             text,
	warehouse_ref         text,
	warehouse_name        text,
	warehouse_address     text,
	street                text,
	building              text,
	apartment             text,
	pickup_point_id       text,
	pickup_point_name     text,
	pickup_address        text,
	status                delivery_status      default 'pending',
	tracking_number       text,
	provider_shipment_ref text,
	last_synced_at        timestamptz,
	provider_status       text,
	provider_status_code  text,
	estimated_cost        numeric(10, 2),
	actual_cost           numeric(10, 2),
	weight_kg             numeric(10, 3),
	customer_notes        text,
	internal_notes        text,
	created_at            timestamptz          default now(),
	updated_at            timestamptz          default now()
);

comment on table  order_deliveries                       is 'Order delivery records with full lifecycle tracking';
comment on column order_deliveries.method                is 'Delivery method selected by customer';
comment on column order_deliveries.sub_type              is 'Sub-type for providers (warehouse, poshtomat, courier)';
comment on column order_deliveries.provider              is 'Delivery provider name (nova_poshta, meest)';
comment on column order_deliveries.tracking_number       is 'Provider tracking number (TTN for Nova Post)';
comment on column order_deliveries.provider_shipment_ref is 'Provider internal shipment reference';
comment on column order_deliveries.status                is 'Current delivery status';

-- ----------------------------------------------------------------------------
-- Indexes (order_deliveries) — 4 from 038, unchanged
-- ----------------------------------------------------------------------------

create unique index idx_order_deliveries_order on order_deliveries (order_id);
create index idx_order_deliveries_company_status on order_deliveries (company_id, status);
create index idx_order_deliveries_tracking on order_deliveries (tracking_number) where tracking_number is not null;
create index idx_order_deliveries_provider on order_deliveries (provider, status) where provider is not null;

-- ----------------------------------------------------------------------------
-- RLS (order_deliveries) — upgraded to is_company_member, matching orders
-- pattern from 012_orders.sql
-- ----------------------------------------------------------------------------

alter table order_deliveries enable row level security;
alter table order_deliveries force row level security;

create policy "order_deliveries: select"
	on order_deliveries
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'orders:view', (select auth.uid()))
		or exists (
			select 1 from orders o
			join company_customers cc on cc.id = o.customer_id
			where o.id = order_deliveries.order_id
			  and cc.user_id = (select auth.uid())
		)
	);

create policy "order_deliveries: member insert"
	on order_deliveries
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'orders:edit', (select auth.uid())));

create policy "order_deliveries: member update"
	on order_deliveries
	for update
	to authenticated
	using (has_company_permission(company_id, 'orders:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'orders:edit', (select auth.uid())));

create policy "order_deliveries: member delete"
	on order_deliveries
	for delete
	to authenticated
	using (has_company_permission(company_id, 'orders:edit', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (order_deliveries)
-- ----------------------------------------------------------------------------

create trigger order_deliveries_update_timestamp
	before update on order_deliveries
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 7: FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: upsert_delivery_city (final version from 079)
-- SECURITY DEFINER sync function. Upserts city with optional coordinates.
-- Improvement: fixed set search_path from 'public' to '' for security
-- consistency with other sync functions. Qualified table as public.delivery_cities.
-- ----------------------------------------------------------------------------

create or replace function upsert_delivery_city(
	p_provider text,
	p_city_ref text,
	p_name_uk text,
	p_name_en text default null,
	p_area_uk text default null,
	p_area_en text default null,
	p_settlement_type text default null,
	p_is_popular boolean default false,
	p_settlement_ref text default null,
	p_region_uk text default null,
	p_region_en text default null,
	p_latitude double precision default null,
	p_longitude double precision default null
) returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_city_id uuid;
	v_settlement_ref text;
begin
	v_settlement_ref := coalesce(p_settlement_ref, p_city_ref);

	insert into public.delivery_cities (
		provider,
		city_ref,
		settlement_ref,
		name_uk,
		name_en,
		area_uk,
		area_en,
		region_uk,
		region_en,
		settlement_type,
		is_popular,
		latitude,
		longitude
	) values (
		p_provider,
		p_city_ref,
		v_settlement_ref,
		p_name_uk,
		p_name_en,
		p_area_uk,
		p_area_en,
		p_region_uk,
		p_region_en,
		p_settlement_type,
		p_is_popular,
		p_latitude,
		p_longitude
	)
	on conflict (provider, city_ref) do update
	set name_uk         = excluded.name_uk,
	    name_en         = excluded.name_en,
	    settlement_ref  = excluded.settlement_ref,
	    area_uk         = excluded.area_uk,
	    area_en         = excluded.area_en,
	    region_uk       = excluded.region_uk,
	    region_en       = excluded.region_en,
	    settlement_type = excluded.settlement_type,
	    is_popular      = excluded.is_popular,
	    latitude        = coalesce(excluded.latitude, public.delivery_cities.latitude),
	    longitude       = coalesce(excluded.longitude, public.delivery_cities.longitude),
	    updated_at      = now()
	returning id into v_city_id;

	return v_city_id;
end;
$$;

comment on function upsert_delivery_city is
	'Upserts a delivery city/settlement from provider sync (with optional coordinates)';

grant execute on function upsert_delivery_city to service_role;

-- ----------------------------------------------------------------------------
-- Function: upsert_delivery_warehouse (from 039)
-- SECURITY DEFINER sync function. Upserts warehouse with settlement_ref.
-- ----------------------------------------------------------------------------

create or replace function upsert_delivery_warehouse(
	p_provider text,
	p_warehouse_ref text,
	p_city_ref text,
	p_number text,
	p_name_uk text,
	p_name_en text default null,
	p_short_address text default null,
	p_full_address text default null,
	p_warehouse_type text default 'warehouse',
	p_latitude decimal default null,
	p_longitude decimal default null,
	p_phone text default null,
	p_schedule_mon text default null,
	p_schedule_tue text default null,
	p_schedule_wed text default null,
	p_schedule_thu text default null,
	p_schedule_fri text default null,
	p_schedule_sat text default null,
	p_schedule_sun text default null,
	p_max_weight_kg decimal default null,
	p_is_active boolean default true,
	p_settlement_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id uuid;
	v_settlement_ref text;
begin
	v_settlement_ref := coalesce(p_settlement_ref, p_city_ref);

	insert into public.delivery_warehouses (
		provider,
		warehouse_ref,
		city_ref,
		settlement_ref,
		number,
		name_uk,
		name_en,
		short_address,
		full_address,
		warehouse_type,
		latitude,
		longitude,
		phone,
		schedule_mon,
		schedule_tue,
		schedule_wed,
		schedule_thu,
		schedule_fri,
		schedule_sat,
		schedule_sun,
		max_weight_kg,
		is_active
	)
	values (
		p_provider,
		p_warehouse_ref,
		p_city_ref,
		v_settlement_ref,
		p_number,
		p_name_uk,
		p_name_en,
		p_short_address,
		p_full_address,
		p_warehouse_type,
		p_latitude,
		p_longitude,
		p_phone,
		p_schedule_mon,
		p_schedule_tue,
		p_schedule_wed,
		p_schedule_thu,
		p_schedule_fri,
		p_schedule_sat,
		p_schedule_sun,
		p_max_weight_kg,
		p_is_active
	)
	on conflict (provider, warehouse_ref) do update set
		city_ref = excluded.city_ref,
		settlement_ref = excluded.settlement_ref,
		number = excluded.number,
		name_uk = excluded.name_uk,
		name_en = coalesce(excluded.name_en, public.delivery_warehouses.name_en),
		short_address = coalesce(excluded.short_address, public.delivery_warehouses.short_address),
		full_address = coalesce(excluded.full_address, public.delivery_warehouses.full_address),
		warehouse_type = excluded.warehouse_type,
		latitude = coalesce(excluded.latitude, public.delivery_warehouses.latitude),
		longitude = coalesce(excluded.longitude, public.delivery_warehouses.longitude),
		phone = coalesce(excluded.phone, public.delivery_warehouses.phone),
		schedule_mon = coalesce(excluded.schedule_mon, public.delivery_warehouses.schedule_mon),
		schedule_tue = coalesce(excluded.schedule_tue, public.delivery_warehouses.schedule_tue),
		schedule_wed = coalesce(excluded.schedule_wed, public.delivery_warehouses.schedule_wed),
		schedule_thu = coalesce(excluded.schedule_thu, public.delivery_warehouses.schedule_thu),
		schedule_fri = coalesce(excluded.schedule_fri, public.delivery_warehouses.schedule_fri),
		schedule_sat = coalesce(excluded.schedule_sat, public.delivery_warehouses.schedule_sat),
		schedule_sun = coalesce(excluded.schedule_sun, public.delivery_warehouses.schedule_sun),
		max_weight_kg = coalesce(excluded.max_weight_kg, public.delivery_warehouses.max_weight_kg),
		is_active = excluded.is_active,
		updated_at = now()
	returning id into v_id;

	return v_id;
end;
$$;

comment on function upsert_delivery_warehouse is 'Upsert a delivery warehouse record with settlement_ref support';

-- ----------------------------------------------------------------------------
-- Function: get_delivery_warehouses (from 039)
-- SECURITY DEFINER RPC for checkout form.
-- ----------------------------------------------------------------------------

create or replace function get_delivery_warehouses(
	p_provider text,
	p_settlement_ref text,
	p_warehouse_type text default null,
	p_search text default null,
	p_limit int default 100
)
returns table (
	warehouse_ref text,
	number text,
	name_uk text,
	short_address text,
	warehouse_type text,
	latitude decimal,
	longitude decimal,
	city_ref text,
	settlement_ref text,
	city_name text,
	phone text,
	schedule_mon text,
	schedule_tue text,
	schedule_wed text,
	schedule_thu text,
	schedule_fri text,
	schedule_sat text,
	schedule_sun text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
	return query
	select
		dw.warehouse_ref,
		dw.number,
		dw.name_uk,
		dw.short_address,
		dw.warehouse_type,
		dw.latitude,
		dw.longitude,
		dw.city_ref,
		dw.settlement_ref,
		coalesce(dc.name_uk, '') as city_name,
		dw.phone,
		dw.schedule_mon,
		dw.schedule_tue,
		dw.schedule_wed,
		dw.schedule_thu,
		dw.schedule_fri,
		dw.schedule_sat,
		dw.schedule_sun
	from public.delivery_warehouses dw
	left join public.delivery_cities dc on dc.provider = dw.provider
		and (dc.settlement_ref = dw.settlement_ref or dc.city_ref = dw.city_ref)
	where dw.provider = p_provider
		and (dw.settlement_ref = p_settlement_ref or dw.city_ref = p_settlement_ref)
		and dw.is_active = true
		and (p_warehouse_type is null or dw.warehouse_type = p_warehouse_type)
		and (p_search is null or dw.name_uk ilike '%' || p_search || '%' or dw.number ilike '%' || p_search || '%')
	order by
		case when dw.number ~ '^\d+$' then lpad(dw.number, 10, '0') else dw.number end
	limit p_limit;
end;
$$;

comment on function get_delivery_warehouses is 'Get warehouses for a settlement with optional type filter and search';

-- ----------------------------------------------------------------------------
-- Function: upsert_delivery_street (final version from 097)
-- SECURITY DEFINER sync function. Upserts street with optional coordinates.
-- ----------------------------------------------------------------------------

create or replace function upsert_delivery_street(
	p_provider text,
	p_street_ref text,
	p_settlement_ref text,
	p_name_uk text,
	p_name_en text default null,
	p_street_type text default null,
	p_latitude double precision default null,
	p_longitude double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id uuid;
begin
	insert into public.delivery_streets (
		provider,
		street_ref,
		city_ref,
		settlement_ref,
		name_uk,
		name_en,
		street_type,
		latitude,
		longitude
	)
	values (
		p_provider,
		p_street_ref,
		p_settlement_ref,
		p_settlement_ref,
		p_name_uk,
		p_name_en,
		p_street_type,
		p_latitude,
		p_longitude
	)
	on conflict (provider, street_ref) do update set
		city_ref = excluded.city_ref,
		settlement_ref = excluded.settlement_ref,
		name_uk = excluded.name_uk,
		name_en = coalesce(excluded.name_en, public.delivery_streets.name_en),
		street_type = coalesce(excluded.street_type, public.delivery_streets.street_type),
		latitude = coalesce(excluded.latitude, public.delivery_streets.latitude),
		longitude = coalesce(excluded.longitude, public.delivery_streets.longitude),
		updated_at = now()
	returning id into v_id;

	return v_id;
end;
$$;

comment on function upsert_delivery_street is 'Upsert a delivery street record with settlement_ref and optional coordinates';

-- ----------------------------------------------------------------------------
-- Function: get_delivery_streets (final version from 097)
-- SECURITY DEFINER RPC for courier delivery form. Includes coordinates.
-- ----------------------------------------------------------------------------

create or replace function get_delivery_streets(
	p_provider text,
	p_settlement_ref text,
	p_search text default null,
	p_limit int default 50
)
returns table (
	street_ref text,
	name_uk text,
	street_type text,
	latitude double precision,
	longitude double precision
)
language plpgsql
security definer
set search_path = ''
as $$
begin
	return query
	select
		ds.street_ref,
		ds.name_uk,
		ds.street_type,
		ds.latitude,
		ds.longitude
	from public.delivery_streets ds
	where ds.provider = p_provider
		and (ds.settlement_ref = p_settlement_ref or ds.city_ref = p_settlement_ref)
		and (p_search is null or ds.name_uk ilike '%' || p_search || '%')
	order by ds.name_uk
	limit p_limit;
end;
$$;

comment on function get_delivery_streets is 'Get streets for a settlement with optional search, including coordinates';

grant execute on function upsert_delivery_warehouse to service_role;
grant execute on function upsert_delivery_street to service_role;
grant execute on function get_delivery_warehouses to authenticated;
grant execute on function get_delivery_streets to authenticated;

-- ############################################################################
-- PART 8: REALTIME CONFIGURATION (from 052)
-- ############################################################################

alter table order_deliveries replica identity full;

alter publication supabase_realtime add table order_deliveries;

comment on table order_deliveries is
	'Order delivery records with full lifecycle tracking. Uses REPLICA IDENTITY FULL for realtime delivery status updates.';
