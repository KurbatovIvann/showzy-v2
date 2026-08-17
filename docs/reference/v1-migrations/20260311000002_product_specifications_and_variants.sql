-- ============================================================================
-- Migration: product_specifications_and_variants
-- Description: Restructure product physical spec columns (weight, size → structured),
--              create foundation tables for product options & variants (no UI yet).
-- Dependencies: products (20260301000007)
-- ============================================================================

-- ############################################################################
-- PART 1: RESTRUCTURE PHYSICAL SPEC COLUMNS ON PRODUCTS
-- ############################################################################

-- Drop unused free-text columns
alter table products drop column if exists weight;
alter table products drop column if exists size;

-- Add structured physical specification columns
alter table products
	add column weight_value   numeric(10, 4),
	add column weight_unit    text,
	add column length_value   numeric(10, 4),
	add column width_value    numeric(10, 4),
	add column height_value   numeric(10, 4),
	add column dimension_unit text,
	add column volume_value   numeric(10, 4),
	add column volume_unit    text;

-- Restrict to valid measurement units
alter table products
	add constraint products_weight_unit_check
		check (weight_unit is null or weight_unit in ('g', 'kg', 'oz', 'lb')),
	add constraint products_dimension_unit_check
		check (dimension_unit is null or dimension_unit in ('mm', 'cm', 'm', 'in')),
	add constraint products_volume_unit_check
		check (volume_unit is null or volume_unit in ('ml', 'l'));

-- Enforce value ↔ unit consistency: can't have one without the other
alter table products
	add constraint products_weight_consistency
		check ((weight_value is null) = (weight_unit is null)),
	add constraint products_volume_consistency
		check ((volume_value is null) = (volume_unit is null)),
	add constraint products_dimension_consistency
		check (
			(length_value is not null or width_value is not null or height_value is not null)
			= (dimension_unit is not null)
		);

comment on column products.weight_value   is 'Numeric weight of the product';
comment on column products.weight_unit    is 'Weight measurement unit (g, kg, oz, lb)';
comment on column products.length_value   is 'Length dimension of the product';
comment on column products.width_value    is 'Width dimension of the product';
comment on column products.height_value   is 'Height dimension of the product';
comment on column products.dimension_unit is 'Dimension measurement unit (mm, cm, m, in)';
comment on column products.volume_value   is 'Volume/capacity of the product';
comment on column products.volume_unit    is 'Volume measurement unit (ml, l)';

-- ############################################################################
-- PART 2: PRODUCT OPTIONS (foundation for future variants UI)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: product_options — option groups per product (e.g. "Color", "Size")
-- ----------------------------------------------------------------------------

create table if not exists product_options (
	id         uuid        default gen_random_uuid() primary key,
	product_id uuid        not null references products (id) on delete cascade,
	company_id uuid        not null references companies (id) on delete cascade,
	name       text        not null,
	sort_order integer     default 0,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

comment on table product_options is 'Option groups for product variants (e.g. Color, Size). Foundation for future variants UI.';

-- Indexes: FK columns per schema-foreign-key-indexes best practice
create index idx_product_options_product_id on product_options (product_id);
create index idx_product_options_company_id on product_options (company_id);

-- RLS
alter table product_options enable row level security;
alter table product_options force row level security;

create policy "product_options: public read"
	on product_options
	for select
	using (true);

create policy "product_options: member insert"
	on product_options
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'products:create', (select auth.uid())));

create policy "product_options: member update"
	on product_options
	for update
	to authenticated
	using (has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'products:edit', (select auth.uid())));

create policy "product_options: member delete"
	on product_options
	for delete
	to authenticated
	using (has_company_permission(company_id, 'products:delete', (select auth.uid())));

-- Trigger
create trigger trigger_update_product_options_timestamp
	before update on product_options
	for each row
	execute function update_timestamp();

-- ----------------------------------------------------------------------------
-- Table: product_option_values — values within option groups (e.g. "Red", "Blue")
-- ----------------------------------------------------------------------------

create table if not exists product_option_values (
	id         uuid        default gen_random_uuid() primary key,
	option_id  uuid        not null references product_options (id) on delete cascade,
	value      text        not null,
	sort_order integer     default 0,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

comment on table product_option_values is 'Values within product option groups (e.g. Red, Blue for Color). Foundation for future variants UI.';

-- Indexes
create index idx_product_option_values_option_id on product_option_values (option_id);

-- RLS (inherits access through product_options → products chain)
alter table product_option_values enable row level security;
alter table product_option_values force row level security;

create policy "product_option_values: public read"
	on product_option_values
	for select
	using (true);

create policy "product_option_values: member insert"
	on product_option_values
	for insert
	to authenticated
	with check (
		exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:create', (select auth.uid()))
		)
	);

create policy "product_option_values: member update"
	on product_option_values
	for update
	to authenticated
	using (
		exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:edit', (select auth.uid()))
		)
	)
	with check (
		exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:edit', (select auth.uid()))
		)
	);

create policy "product_option_values: member delete"
	on product_option_values
	for delete
	to authenticated
	using (
		exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:delete', (select auth.uid()))
		)
	);

-- Trigger
create trigger trigger_update_product_option_values_timestamp
	before update on product_option_values
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: PRODUCT VARIANTS (foundation for future variants UI)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: product_variants — unique combination of option values per product
-- Pricing is handled by the existing price_lists / price_list_items system.
-- When variant support is added to pricing, price_list_items gains a variant_id FK.
-- ----------------------------------------------------------------------------

create table if not exists product_variants (
	id               uuid        default gen_random_uuid() primary key,
	product_id       uuid        not null references products (id) on delete cascade,
	company_id       uuid        not null references companies (id) on delete cascade,
	sku              text,
	weight_value     numeric(10, 4),
	weight_unit      text,
	stock_quantity   integer     default 0,
	track_inventory  boolean     default true,
	allow_backorders boolean     default false,
	is_active        boolean     default true,
	sort_order       integer     default 0,
	created_at       timestamptz default now(),
	updated_at       timestamptz default now(),

	constraint product_variants_weight_unit_check
		check (weight_unit is null or weight_unit in ('g', 'kg', 'oz', 'lb')),
	constraint product_variants_weight_consistency
		check ((weight_value is null) = (weight_unit is null))
);

comment on table product_variants is 'Product variants — unique combinations of option values with own SKU and inventory. Foundation for future variants UI.';

-- Indexes
create index idx_product_variants_product_id on product_variants (product_id);
create index idx_product_variants_company_id on product_variants (company_id);

-- RLS
alter table product_variants enable row level security;
alter table product_variants force row level security;

create policy "product_variants: public read"
	on product_variants
	for select
	using (true);

create policy "product_variants: member insert"
	on product_variants
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'products:create', (select auth.uid())));

create policy "product_variants: member update"
	on product_variants
	for update
	to authenticated
	using (has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'products:edit', (select auth.uid())));

create policy "product_variants: member delete"
	on product_variants
	for delete
	to authenticated
	using (has_company_permission(company_id, 'products:delete', (select auth.uid())));

-- Trigger
create trigger trigger_update_product_variants_timestamp
	before update on product_variants
	for each row
	execute function update_timestamp();

-- ----------------------------------------------------------------------------
-- Table: product_variant_options — junction: variant ↔ option value
-- ----------------------------------------------------------------------------

create table if not exists product_variant_options (
	id              uuid default gen_random_uuid() primary key,
	variant_id      uuid not null references product_variants (id) on delete cascade,
	option_id       uuid not null references product_options (id) on delete cascade,
	option_value_id uuid not null references product_option_values (id) on delete cascade,

	unique (variant_id, option_id)
);

comment on table product_variant_options is 'Junction table linking variants to their option values. Foundation for future variants UI.';

-- Indexes
create index idx_product_variant_options_variant_id      on product_variant_options (variant_id);
create index idx_product_variant_options_option_value_id on product_variant_options (option_value_id);

-- RLS (inherits through variant → product chain)
alter table product_variant_options enable row level security;
alter table product_variant_options force row level security;

create policy "product_variant_options: public read"
	on product_variant_options
	for select
	using (true);

create policy "product_variant_options: member insert"
	on product_variant_options
	for insert
	to authenticated
	with check (
		exists (
			select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:create', (select auth.uid()))
		)
	);

create policy "product_variant_options: member update"
	on product_variant_options
	for update
	to authenticated
	using (
		exists (
			select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:edit', (select auth.uid()))
		)
	)
	with check (
		exists (
			select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:edit', (select auth.uid()))
		)
	);

create policy "product_variant_options: member delete"
	on product_variant_options
	for delete
	to authenticated
	using (
		exists (
			select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:delete', (select auth.uid()))
		)
	);

-- ############################################################################
-- PART 4: UPDATE products_view
-- ############################################################################

-- Recreate the view with new physical spec columns and has_variants flag.
-- Must use CREATE OR REPLACE since we're only adding new columns
-- (existing columns and their order are preserved).
drop view if exists public.products_view;

create or replace view public.products_view
with (security_invoker = on)
as
select
	products.company_id,
	products.id,
	products.name,
	products.description,
	products.price,
	products.hide_price,
	(
		select pi.image_url
		from product_images pi
		where pi.product_id = products.id
		  and pi.is_primary = true
		limit 1
	) as image_url,
	products.stock_quantity,
	products.track_inventory,
	products.low_stock_threshold,
	products.allow_backorders,
	products.updated_at,
	products.created_at,
	product_categories.name as category,
	cs.name                 as status,
	cs.code                 as status_code,
	cs.color                as status_color,
	cs.icon                 as status_icon,
	ut.id                   as unit_type_id,
	ut.code                 as unit_type_code,
	ut.name                 as unit_type_name,
	ut.symbol               as unit_type_symbol,
	products.weight_value,
	products.weight_unit,
	products.length_value,
	products.width_value,
	products.height_value,
	products.dimension_unit,
	products.volume_value,
	products.volume_unit,
	exists (
		select 1 from product_variants pv
		where pv.product_id = products.id and pv.is_active = true
	) as has_variants
from products
	left join product_categories on products.category_id = product_categories.id
	left join company_statuses cs on products.status_id = cs.id
	left join unit_types ut on products.unit_type_id = ut.id;

comment on view public.products_view is 'Products with joined category, status, unit type, physical specs, and primary image information';
