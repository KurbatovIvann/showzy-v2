-- ============================================================================
-- Migration: payments_fiscal_checkout
-- Description: Extends mono_acquiring_invoices with receipt + fiscal columns,
--              adds fiscal fields to products and payment_settings,
--              auto-generate SKU trigger, updated views, checkout session
--              mono_acquiring payment method, and payments permissions.
-- Consolidates: 0317 + 0318 + 0320 + 0403
-- Dependencies: products (20260301000007),
--               product_specifications_and_variants (20260311000002),
--               consumer_products_standardization (20260312000001),
--               mono_acquiring (20260314000001)
-- ============================================================================

-- ############################################################################
-- PART 1: ALTER — mono_acquiring_invoices (receipt + fiscal columns)
-- ############################################################################

alter table mono_acquiring_invoices
	add column if not exists receipt_url text,
	add column if not exists receipt_fetched_at timestamptz;

comment on column mono_acquiring_invoices.receipt_url
	is 'URL of the fiscal receipt returned by Monobank receipt API';
comment on column mono_acquiring_invoices.receipt_fetched_at
	is 'Timestamp when the receipt was fetched from Monobank';

alter table mono_acquiring_invoices
	add column if not exists fiscal_status   text,
	add column if not exists fiscal_tax_url  text,
	add column if not exists fiscal_check_id text;

alter table mono_acquiring_invoices
	add constraint mono_acq_invoices_fiscal_status_check
		check (fiscal_status is null or fiscal_status in ('new', 'process', 'done', 'failed'));

comment on column mono_acquiring_invoices.fiscal_status
	is 'Checkbox fiscal check status: new, process, done, failed';
comment on column mono_acquiring_invoices.fiscal_tax_url
	is 'Link to the fiscal receipt on the ДПС (tax authority) website';
comment on column mono_acquiring_invoices.fiscal_check_id
	is 'Checkbox fiscal check UUID';

-- ############################################################################
-- PART 2: ADD FISCAL COLUMNS TO products (SKU nullable)
-- ############################################################################

alter table products
	add column if not exists sku     text,
	add column if not exists barcode text,
	add column if not exists uktzed  text;

comment on column products.sku     is 'Short merchant-defined product code used on fiscal receipts (Checkbox "code" field). Auto-generated on insert if null.';
comment on column products.barcode is 'Product barcode (EAN-13, UPC, etc.) for fiscal receipts and inventory scanning';
comment on column products.uktzed  is 'UKT ZED commodity classification code. Required only for excise/import goods.';

create unique index idx_products_company_sku
	on products (company_id, sku);

create unique index idx_products_company_barcode
	on products (company_id, barcode)
	where barcode is not null;

-- ############################################################################
-- PART 3: ADD FISCAL SETTINGS TO payment_settings
-- ############################################################################

alter table payment_settings
	add column if not exists fiscalization_enabled boolean default false,
	add column if not exists fiscal_tax_codes      integer[];

comment on column payment_settings.fiscalization_enabled
	is 'Master toggle: whether this company uses Checkbox fiscalization via Monobank';
comment on column payment_settings.fiscal_tax_codes
	is 'Checkbox tax group codes applied to all products (e.g. {8} for "Без ПДВ", {5} for "ПДВ 20%")';

-- ############################################################################
-- PART 4: AUTO-GENERATE SKU TRIGGER
-- ############################################################################

create table if not exists company_sku_sequences (
	company_id uuid primary key references companies (id) on delete cascade,
	next_val   integer not null default 1
);

comment on table company_sku_sequences
	is 'Per-company counter for auto-generating sequential product SKU codes';

alter table company_sku_sequences enable row level security;
alter table company_sku_sequences force row level security;

create or replace function trg_auto_generate_sku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_next integer;
begin
	if new.sku is not null then
		return new;
	end if;

	insert into public.company_sku_sequences (company_id, next_val)
	values (new.company_id, 2)
	on conflict (company_id) do update
		set next_val = public.company_sku_sequences.next_val + 1
	returning next_val - 1 into v_next;

	new.sku := lpad(v_next::text, 3, '0');

	return new;
end;
$$;

comment on function trg_auto_generate_sku()
	is 'Auto-generates a short sequential SKU (e.g. 001, 042) for products inserted without one';

create trigger trg_products_auto_sku
	before insert on products
	for each row
	execute function trg_auto_generate_sku();

-- Backfill SKUs for existing products that have none.
with numbered as (
	select
		p.id,
		p.company_id,
		row_number() over (partition by p.company_id order by p.created_at, p.id) as rn
	from products p
	where p.sku is null
)
update products
set sku = lpad(numbered.rn::text, 3, '0')
from numbered
where products.id = numbered.id;

-- Seed sequence counters for companies that had existing products.
insert into company_sku_sequences (company_id, next_val)
select
	p.company_id,
	count(*) + 1
from products p
group by p.company_id
on conflict (company_id) do update
	set next_val = greatest(company_sku_sequences.next_val, excluded.next_val);

-- ############################################################################
-- PART 5: UPDATE products_view
-- ############################################################################

drop view if exists public.products_view;

create view public.products_view
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
	) as has_variants,
	products.sku,
	products.barcode,
	products.uktzed
from products
	left join product_categories on products.category_id = product_categories.id
	left join company_statuses cs on products.status_id = cs.id
	left join unit_types ut on products.unit_type_id = ut.id;

comment on view public.products_view
	is 'Products with joined category, status, unit type, physical specs, primary image, and fiscal fields';

-- ############################################################################
-- PART 6: UPDATE consumer_products_view
-- ############################################################################

create or replace view public.consumer_products_view
with (security_invoker = on)
as
select
	pr.id,
	pr.company_id,
	pr.name,
	pr.description,
	pr.price          as base_price,
	pr.hide_price,
	pc.name           as category,
	pr.updated_at,
	pr.likes_count,
	(select count(*)
	 from public.product_comments pcc
	 where pcc.product_id = pr.id and pcc.parent_id is null
	)::int as comments_count,
	coalesce(
		(select auth.uid()) is not null
		and exists(
			select 1 from public.product_likes pl
			where pl.product_id = pr.id and pl.user_id = (select auth.uid())
		),
		false
	) as liked,
	coalesce((
		select json_agg(
			json_build_object(
				'imageUrl', pi.image_url,
				'displayOrder', pi.display_order,
				'isPrimary', pi.is_primary
			)
			order by pi.display_order
		)
		from public.product_images pi
		where pi.product_id = pr.id
	), '[]'::json) as images,
	pr.fts,
	ut.code           as unit_type_code,
	ut.name           as unit_type_name,
	ut.symbol         as unit_type_symbol,
	pr.weight_value,
	pr.weight_unit,
	pr.length_value,
	pr.width_value,
	pr.height_value,
	pr.dimension_unit,
	pr.volume_value,
	pr.volume_unit,
	pr.stock_quantity,
	pr.track_inventory,
	exists(
		select 1 from public.product_variants pv
		where pv.product_id = pr.id and pv.is_active
	) as has_variants,
	pr.sku,
	pr.barcode
from public.products pr
	join public.company_statuses cs on pr.status_id = cs.id
	left join public.product_categories pc on pr.category_id = pc.id
	left join public.unit_types ut on pr.unit_type_id = ut.id
where cs.code = 'active';

comment on view public.consumer_products_view is
	'Consumer-facing products with engagement data, unit types, physical specs, variant flag, and fiscal identifiers. Single source of truth for all consumer product RPCs.';

-- ############################################################################
-- PART 7: CHECKOUT SESSION — mono_acquiring payment method
-- ############################################################################

alter table checkout_sessions
  drop constraint if exists checkout_sessions_payment_method_check;

alter table checkout_sessions
  add constraint checkout_sessions_payment_method_check
    check (payment_method is null or payment_method in (
      'card', 'apple_pay', 'google_pay', 'bank_transfer', 'cash_on_delivery', 'mono_acquiring'));

-- ############################################################################
-- PART 8: SEED — payments permissions
-- ############################################################################

insert into role_permission_defaults (role, permission) values
	('admin', 'payments:view'),
	('admin', 'payments:manage'),
	('manager', 'payments:view')
on conflict do nothing;
