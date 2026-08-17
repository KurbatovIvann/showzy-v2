-- ============================================================================
-- Migration: carts
-- Description: Shopping cart system — carts with single-company enforcement,
--              atomic cart updates, price refresh, and an aggregated cart view.
-- Dependencies: companies, products, product_categories, unit_types,
--               product_images, company_customers, customer_groups, price_lists,
--               resolve_product_price (008), core_functions (update_timestamp)
-- Sources: 016_carts, 037_update_cart_items (unwrapped from DO block),
--          044_refresh_cart_prices, 025_product_images (carts_view only)
-- ============================================================================

-- ############################################################################
-- PART 1: CARTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: carts
-- Fix from original 016: removed FK on company_slug. The original had
-- `company_slug text references companies(slug) on delete cascade` — a text FK
-- without ON UPDATE CASCADE that breaks if a company changes their slug.
-- Kept as plain text; set programmatically by validate_cart_company() and
-- update_cart_items_bulk().
-- ----------------------------------------------------------------------------

create table if not exists carts (
	id           uuid          default gen_random_uuid() primary key,
	user_id      uuid          not null references auth.users (id) on delete cascade,
	company_id   uuid          references companies (id) on delete cascade,
	company_slug text,
	total_price  decimal(10,2) default 0 not null,
	created_at   timestamptz   default now(),
	updated_at   timestamptz   default now(),

	constraint carts_user_company_unique unique (user_id, company_id)
);

comment on table  carts            is 'Shopping carts — one per user per company';
comment on column carts.company_id is 'Company this cart belongs to — enforces single-company cart per user';
comment on column carts.company_slug is 'Company slug for quick reference (denormalized, set by triggers/RPCs)';

-- ----------------------------------------------------------------------------
-- RLS (carts) — from 016, untouched by 062
-- ----------------------------------------------------------------------------

alter table carts enable row level security;
alter table carts force row level security;

create policy "carts: user access"
	on carts
	for all
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- Trigger (carts)
-- ----------------------------------------------------------------------------

create trigger carts_update_timestamp
	before update on carts
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 2: CART ITEMS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: cart_items
-- Improvements from original 016: added CHECK constraints for quantity and
-- price validation at the DB level.
-- ----------------------------------------------------------------------------

create table if not exists cart_items (
	id         uuid          default gen_random_uuid() primary key,
	cart_id    uuid          not null references carts (id) on delete cascade,
	product_id uuid          not null references products (id) on delete cascade,
	quantity   integer       not null default 1,
	price      decimal(10,2) not null,
	created_at timestamptz   default now(),

	constraint cart_items_cart_id_product_id_key unique (cart_id, product_id),
	constraint cart_items_quantity_check check (quantity > 0),
	constraint cart_items_price_check check (price >= 0)
);

comment on table  cart_items       is 'Items in a shopping cart';
comment on column cart_items.price is 'Price at time item was added (resolved customer price)';
comment on constraint cart_items_cart_id_product_id_key on cart_items is
	'Ensures one product per cart (company tracked at cart level)';

-- ----------------------------------------------------------------------------
-- Indexes (cart_items)
-- ----------------------------------------------------------------------------

create index idx_cart_items_product_id on cart_items (product_id);

-- ----------------------------------------------------------------------------
-- RLS (cart_items) — from 016, untouched by 062
-- ----------------------------------------------------------------------------

alter table cart_items enable row level security;
alter table cart_items force row level security;

create policy "cart_items: user access"
	on cart_items
	for all
	using (exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid())))
	with check (exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));

-- ############################################################################
-- PART 3: FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: validate_cart_company (from 016)
-- SECURITY DEFINER trigger function. Ensures cart items belong to the same
-- company as the cart. Sets company_id and company_slug on first item.
-- ----------------------------------------------------------------------------

create or replace function validate_cart_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_cart_company_id uuid;
	v_product_company_id uuid;
begin
	select company_id into v_cart_company_id
	from public.carts
	where id = new.cart_id;

	select company_id into v_product_company_id
	from public.products
	where id = new.product_id;

	if v_cart_company_id is null then
		update public.carts
		set company_id = v_product_company_id,
		    company_slug = (select slug from public.companies where id = v_product_company_id)
		where id = new.cart_id;
	elsif v_cart_company_id != v_product_company_id then
		raise exception 'Cannot add products from different companies to cart. Please complete your current order first.';
	end if;

	return new;
end;
$$;

comment on function validate_cart_company() is
	'Validates that cart items belong to the same company as the cart';

-- Trigger to enforce single-company cart
create trigger enforce_single_company_cart
	before insert on cart_items
	for each row
	execute function validate_cart_company();

-- ----------------------------------------------------------------------------
-- Function: update_cart_items_bulk (from 037)
-- SECURITY DEFINER RPC. Atomically upserts cart, clears items, bulk-inserts
-- new items. Unwrapped from original DO wrapper block (workaround no longer
-- needed in consolidated migration).
-- ----------------------------------------------------------------------------

create or replace function update_cart_items_bulk(
	p_cart_id uuid,
	p_user_id uuid,
	p_company_id uuid,
	p_company_slug text,
	p_items jsonb,
	p_total_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_cart_id uuid;
	v_result jsonb;
begin
	if p_user_id is null or p_user_id != (select auth.uid()) then
		raise exception 'AUTH_MISMATCH:User ID does not match authenticated user';
	end if;

	insert into public.carts (user_id, company_id, company_slug, total_price, updated_at)
	values (p_user_id, p_company_id, p_company_slug, p_total_price, now())
	on conflict (user_id, company_id)
	do update set
		total_price = p_total_price,
		updated_at = now()
	returning id into v_cart_id;

	if p_cart_id is not null and p_cart_id != v_cart_id then
		raise exception 'Cart ID mismatch';
	end if;

	delete from public.cart_items where cart_id = v_cart_id;

	if jsonb_array_length(p_items) > 0 then
		insert into public.cart_items (cart_id, product_id, quantity, price)
		select
			v_cart_id,
			(item->>'product_id')::uuid,
			(item->>'quantity')::integer,
			(item->>'price')::numeric
		from jsonb_array_elements(p_items) as item;
	end if;

	v_result := jsonb_build_object(
		'cart_id', v_cart_id,
		'total_price', p_total_price,
		'items_count', jsonb_array_length(p_items)
	);

	return v_result;
end;
$$;

comment on function update_cart_items_bulk(uuid, uuid, uuid, text, jsonb, numeric) is
	'Atomically updates cart items in a single transaction to prevent race conditions';

grant execute on function update_cart_items_bulk(uuid, uuid, uuid, text, jsonb, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- Function: refresh_cart_prices (from 044)
-- SECURITY DEFINER RPC. Re-resolves prices for all cart items using the full
-- pricing hierarchy (customer > group > default price list).
-- ----------------------------------------------------------------------------

create or replace function refresh_cart_prices(
	p_cart_id uuid,
	p_user_id uuid,
	p_company_id uuid
) returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_customer_id uuid;
	v_customer_price_list_id uuid;
	v_group_price_list_id uuid;
	v_default_price_list_id uuid;
	v_item record;
	v_resolved_price_result jsonb;
	v_resolved_price numeric;
	v_total_price numeric := 0;
	v_updated_items jsonb := '[]'::jsonb;
begin
	if not exists (
		select 1 from public.carts
		where id = p_cart_id and user_id = p_user_id
	) then
		raise exception 'CART_MISMATCH:Cart does not belong to user';
	end if;

	select cc.id, cc.price_list_id, cg.price_list_id
	into v_customer_id, v_customer_price_list_id, v_group_price_list_id
	from public.company_customers cc
	left join public.customer_groups cg on cg.id = cc.group_id
	where cc.company_id = p_company_id and cc.user_id = p_user_id;

	select id into v_default_price_list_id
	from public.price_lists
	where company_id = p_company_id
	  and is_default = true
	  and is_active = true;

	for v_item in
		select ci.id, ci.product_id, ci.quantity, ci.price as old_price, p.price as base_price, p.name
		from public.cart_items ci
		join public.products p on p.id = ci.product_id
		where ci.cart_id = p_cart_id
	loop
		v_resolved_price_result := resolve_product_price(
			v_item.product_id,
			p_company_id,
			v_customer_id,
			v_customer_price_list_id,
			v_group_price_list_id,
			v_default_price_list_id,
			v_item.base_price
		);

		v_resolved_price := (v_resolved_price_result ->> 'price')::numeric;

		update public.cart_items
		set price = v_resolved_price
		where id = v_item.id;

		v_total_price := v_total_price + (v_resolved_price * v_item.quantity);

		if abs(v_resolved_price - v_item.old_price) > 0.01 then
			v_updated_items := v_updated_items || jsonb_build_object(
				'product_id', v_item.product_id,
				'name', v_item.name,
				'old_price', v_item.old_price,
				'new_price', v_resolved_price,
				'source', v_resolved_price_result ->> 'source'
			);
		end if;
	end loop;

	update public.carts
	set total_price = v_total_price, updated_at = now()
	where id = p_cart_id;

	return jsonb_build_object(
		'success', true,
		'total_price', v_total_price,
		'updated_items', v_updated_items
	);
end;
$$;

comment on function refresh_cart_prices is
	'Updates all cart item prices to current resolved prices using pricing hierarchy (including group price lists). Used for recovery after PRICE_CHANGED error during checkout.';

grant execute on function refresh_cart_prices to authenticated;

-- ############################################################################
-- PART 4: CARTS VIEW (final version from 025 with security_invoker)
-- ############################################################################

create or replace view carts_view
with (security_invoker = on)
as
select
	c.id,
	c.user_id,
	c.company_id,
	c.company_slug,
	c.total_price,
	c.created_at,
	c.updated_at,
	coalesce(jsonb_agg(
		jsonb_build_object(
			'id', p.id,
			'name', p.name,
			'description', p.description,
			'image_url', (
				select pi.image_url
				from product_images pi
				where pi.product_id = p.id and pi.is_primary = true
				limit 1
			),
			'price', ci.price,
			'hide_price', p.hide_price,
			'stock_quantity', p.stock_quantity,
			'track_inventory', p.track_inventory,
			'category', pc.name,
			'quantity', ci.quantity,
			'created_at', ci.created_at,
			'unit_type_code', ut.code,
			'unit_type_name', ut.name,
			'unit_type_symbol', ut.symbol
		)
		order by ci.created_at asc
	) filter (where ci.id is not null), '[]'::jsonb) as items
from carts c
	left join cart_items ci on c.id = ci.cart_id
	left join products p on ci.product_id = p.id
	left join product_categories pc on p.category_id = pc.id
	left join unit_types ut on p.unit_type_id = ut.id
group by c.id;

comment on view carts_view is
	'Shopping cart view with items, product details, and primary images (items ordered by created_at)';
