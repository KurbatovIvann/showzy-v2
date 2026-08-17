-- ============================================================================
-- Migration: order_operations
-- Description: Complex order RPC functions deferred from 012_orders because
--              they depend on order_deliveries (014) and payments (013).
--              Includes atomic order creation with customer linking, order item
--              updates with inventory management, and guest order tracking.
-- Dependencies: orders (012), order_items (012), company_statuses (006),
--               products (007), carts (011), cart_items (011),
--               company_customers (008), customer_groups (008),
--               price_lists (008), resolve_product_price (008),
--               order_deliveries (014), payments (013)
-- Sources: 098_fix_create_order_customer_upsert (create_order_secure),
--          068_order_items_secure_use_is_final (update_order_items_secure),
--          024_guest_checkout (get_order_by_tracking_token)
-- ============================================================================

-- ############################################################################
-- PART 1: FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: create_order_secure (final version from 098)
-- SECURITY DEFINER. Atomic order creation with:
--   - auth.uid() guard (prevents p_user_id spoofing)
--   - Idempotency via p_idempotency_key
--   - Cart validation and ownership check
--   - Customer linking/creation (phone-first from auth.users)
--   - Price resolution via resolve_product_price() with full hierarchy
--   - Inventory locking via FOR UPDATE
--   - Order + items + delivery + payment + cart clear in one transaction
-- Improvement: search_path hardened from 'public' to ''. All table and enum
-- references fully qualified.
-- ----------------------------------------------------------------------------

create or replace function create_order_secure(
	p_company_id uuid,
	p_cart_id uuid,
	p_user_id uuid,
	p_idempotency_key uuid,
	p_customer_info jsonb,
	p_delivery_info jsonb default null,
	p_payment_method text default null,
	p_notes text default null
) returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_order_id uuid;
	v_order_number text;
	v_tracking_token uuid;
	v_customer_id uuid;
	v_customer_price_list_id uuid;
	v_group_price_list_id uuid;
	v_default_price_list_id uuid;
	v_total_price numeric(10, 2) := 0;
	v_default_status_id uuid;
	v_item record;
	v_product record;
	v_resolved_price_result jsonb;
	v_resolved_price numeric;
	v_cart_price numeric;
	v_price_source text;
	v_delivery_id uuid;
	v_customer_name text;
	v_customer_email text;
	v_customer_phone text;
	v_items_processed integer := 0;
	v_order_items jsonb := '[]'::jsonb;
begin
	-- =========================================================================
	-- 0. SECURITY: Verify the caller is the user they claim to be
	-- =========================================================================
	if p_user_id is not null and p_user_id != (select auth.uid()) then
		raise exception 'VALIDATION_ERROR:User ID mismatch';
	end if;

	-- =========================================================================
	-- 1. IDEMPOTENCY CHECK
	-- =========================================================================
	if p_idempotency_key is not null then
		select id, order_number, tracking_token, total_price
		into v_order_id, v_order_number, v_tracking_token, v_total_price
		from public.orders
		where idempotency_key = p_idempotency_key;

		if found then
			return jsonb_build_object(
				'order_id', v_order_id,
				'order_number', v_order_number,
				'tracking_token', v_tracking_token,
				'total_price', v_total_price,
				'success', true,
				'idempotent', true
			);
		end if;
	end if;

	-- =========================================================================
	-- 2. VALIDATE INPUTS
	-- =========================================================================
	if p_company_id is null then
		raise exception 'VALIDATION_ERROR:Company ID is required';
	end if;

	v_customer_name := p_customer_info ->> 'name';
	v_customer_email := p_customer_info ->> 'email';
	v_customer_phone := p_customer_info ->> 'phone';

	if v_customer_name is null or trim(v_customer_name) = '' then
		raise exception 'VALIDATION_ERROR:Customer name is required';
	end if;

	if (v_customer_email is null or trim(v_customer_email) = '')
	   and (v_customer_phone is null or trim(v_customer_phone) = '') then
		raise exception 'VALIDATION_ERROR:Either customer email or phone is required';
	end if;

	-- =========================================================================
	-- 3. VALIDATE CART OWNERSHIP
	-- =========================================================================
	if not exists (
		select 1 from public.carts
		where id = p_cart_id and user_id = p_user_id
	) then
		raise exception 'CART_MISMATCH:Cart does not belong to user';
	end if;

	if not exists (
		select 1 from public.cart_items where cart_id = p_cart_id
	) then
		raise exception 'CART_EMPTY:Cart has no items';
	end if;

	-- =========================================================================
	-- 4. GET OR LINK CUSTOMER RECORD
	--    Reads from auth.users for verified email/phone (immune to
	--    public.users tampering). Links orphan records phone-first,
	--    preferring records with pricing/group data.
	-- =========================================================================
	select cc.id, cc.price_list_id, cg.price_list_id
	into v_customer_id, v_customer_price_list_id, v_group_price_list_id
	from public.company_customers cc
	left join public.customer_groups cg on cg.id = cc.group_id
	where cc.company_id = p_company_id and cc.user_id = p_user_id;

	if v_customer_id is null then
		declare
			v_user_email text;
			v_user_phone text;
			v_is_anon    boolean;
		begin
			select email, phone, coalesce(is_anonymous, false)
			into v_user_email, v_user_phone, v_is_anon
			from auth.users where id = p_user_id;

			if not v_is_anon then

				if v_user_phone is not null then
					select id into v_customer_id
					from public.company_customers
					where company_id = p_company_id
					  and phone = v_user_phone
					  and user_id is null
					order by
						(price_list_id is not null or group_id is not null) desc,
						created_at asc
					for update
					limit 1;

					if v_customer_id is not null then
						update public.company_customers
						set user_id = p_user_id, updated_at = now()
						where id = v_customer_id;
					end if;
				end if;

				if v_customer_id is null and v_user_email is not null then
					select id into v_customer_id
					from public.company_customers
					where company_id = p_company_id
					  and lower(email) = lower(v_user_email)
					  and user_id is null
					order by
						(price_list_id is not null or group_id is not null) desc,
						created_at asc
					for update
					limit 1;

					if v_customer_id is not null then
						update public.company_customers
						set user_id = p_user_id, updated_at = now()
						where id = v_customer_id;
					end if;
				end if;

				if v_customer_id is null then
					insert into public.company_customers (company_id, user_id, name, phone, email)
					values (p_company_id, p_user_id, v_customer_name,
							nullif(trim(v_customer_phone), ''),
							nullif(trim(v_customer_email), ''))
					on conflict (company_id, user_id) do update set updated_at = now()
					returning id into v_customer_id;
				end if;

				select cc.price_list_id, cg.price_list_id
				into v_customer_price_list_id, v_group_price_list_id
				from public.company_customers cc
				left join public.customer_groups cg on cg.id = cc.group_id
				where cc.id = v_customer_id;

			end if;
		end;
	end if;

	select id into v_default_price_list_id
	from public.price_lists
	where company_id = p_company_id
	  and is_default = true
	  and is_active = true;

	select id into v_default_status_id
	from public.company_statuses
	where company_id = p_company_id
	  and entity_type = 'order'
	  and is_default = true
	limit 1;

	if v_default_status_id is null then
		select id into v_default_status_id
		from public.company_statuses
		where company_id = p_company_id
		  and entity_type = 'order'
		order by sort_order
		limit 1;
	end if;

	-- =========================================================================
	-- 5. LOCK PRODUCTS AND VALIDATE
	-- =========================================================================
	v_total_price := 0;

	for v_item in
		select
			ci.product_id,
			ci.quantity,
			ci.price as cart_price,
			p.id as product_id_check,
			p.name as product_name,
			p.price as base_price,
			p.stock_quantity,
			p.track_inventory,
			p.status_id,
			cs.code as status_code
		from public.cart_items ci
		join public.products p on p.id = ci.product_id
		left join public.company_statuses cs on cs.id = p.status_id
		where ci.cart_id = p_cart_id
		order by ci.product_id
		for update of p
	loop
		if v_item.product_id_check is null then
			raise exception 'PRODUCT_NOT_FOUND:%:Product not found', v_item.product_id;
		end if;

		if v_item.status_code is not null and v_item.status_code != 'active' then
			raise exception 'PRODUCT_INACTIVE:%:%', v_item.product_name, 'Product is no longer available';
		end if;

		v_resolved_price_result := public.resolve_product_price(
			v_item.product_id,
			p_company_id,
			v_customer_id,
			v_customer_price_list_id,
			v_group_price_list_id,
			v_default_price_list_id,
			v_item.base_price
		);

		v_resolved_price := (v_resolved_price_result ->> 'price')::numeric;
		v_price_source := v_resolved_price_result ->> 'source';
		v_cart_price := v_item.cart_price;

		if abs(v_resolved_price - v_cart_price) > 0.01 then
			raise exception 'PRICE_CHANGED:%:%:%',
				v_item.product_name,
				v_cart_price::text,
				v_resolved_price::text;
		end if;

		if v_item.track_inventory and v_item.stock_quantity < v_item.quantity then
			raise exception 'INSUFFICIENT_STOCK:%:%:%',
				v_item.product_name,
				v_item.quantity::text,
				v_item.stock_quantity::text;
		end if;

		v_total_price := v_total_price + (v_resolved_price * v_item.quantity);

		v_order_items := v_order_items || jsonb_build_object(
			'product_id', v_item.product_id,
			'quantity', v_item.quantity,
			'price', v_resolved_price,
			'price_source', v_price_source
		);

		v_items_processed := v_items_processed + 1;
	end loop;

	if v_items_processed = 0 then
		raise exception 'CART_EMPTY:No valid items in cart';
	end if;

	-- =========================================================================
	-- 6. CREATE ORDER
	-- =========================================================================
	v_tracking_token := gen_random_uuid();

	insert into public.orders (
		company_id,
		customer_id,
		customer_name,
		customer_email,
		customer_phone,
		notes,
		total_price,
		status_id,
		tracking_token,
		payment_status,
		payment_method,
		idempotency_key
	) values (
		p_company_id,
		v_customer_id,
		v_customer_name,
		v_customer_email,
		v_customer_phone,
		p_notes,
		v_total_price,
		v_default_status_id,
		v_tracking_token,
		'pending',
		p_payment_method,
		p_idempotency_key
	) returning id, order_number into v_order_id, v_order_number;

	-- =========================================================================
	-- 7. CREATE ORDER ITEMS AND REDUCE STOCK
	-- =========================================================================
	for v_item in select * from jsonb_array_elements(v_order_items)
	loop
		insert into public.order_items (
			company_id,
			order_id,
			product_id,
			quantity,
			price
		) values (
			p_company_id,
			v_order_id,
			(v_item.value ->> 'product_id')::uuid,
			(v_item.value ->> 'quantity')::integer,
			(v_item.value ->> 'price')::numeric
		);

		update public.products
		set stock_quantity = stock_quantity - (v_item.value ->> 'quantity')::integer,
		    updated_at = now()
		where id = (v_item.value ->> 'product_id')::uuid
		  and track_inventory = true;
	end loop;

	-- =========================================================================
	-- 8. CREATE DELIVERY RECORD (if delivery info provided)
	-- =========================================================================
	if p_delivery_info is not null and p_delivery_info ->> 'method' is not null then
		insert into public.order_deliveries (
			order_id,
			company_id,
			method,
			sub_type,
			provider,
			city_ref,
			city_name,
			warehouse_ref,
			warehouse_name,
			warehouse_address,
			street,
			building,
			apartment,
			pickup_point_id,
			pickup_point_name,
			pickup_address,
			customer_notes,
			status
		) values (
			v_order_id,
			p_company_id,
			(p_delivery_info ->> 'method')::public.delivery_method_type,
			nullif(p_delivery_info ->> 'sub_type', '')::public.delivery_sub_type,
			nullif(p_delivery_info ->> 'provider', ''),
			nullif(p_delivery_info ->> 'city_ref', ''),
			nullif(p_delivery_info ->> 'city_name', ''),
			nullif(p_delivery_info ->> 'warehouse_ref', ''),
			nullif(p_delivery_info ->> 'warehouse_name', ''),
			nullif(p_delivery_info ->> 'warehouse_address', ''),
			nullif(p_delivery_info ->> 'street', ''),
			nullif(p_delivery_info ->> 'building', ''),
			nullif(p_delivery_info ->> 'apartment', ''),
			nullif(p_delivery_info ->> 'pickup_point_id', ''),
			nullif(p_delivery_info ->> 'pickup_point_name', ''),
			nullif(p_delivery_info ->> 'pickup_address', ''),
			nullif(p_delivery_info ->> 'customer_notes', ''),
			'pending'
		)
		returning id into v_delivery_id;
	end if;

	-- =========================================================================
	-- 9. CREATE PAYMENT RECORD (if payment method provided)
	-- =========================================================================
	if p_payment_method is not null and p_payment_method != '' then
		insert into public.payments (
			company_id,
			order_id,
			method,
			status,
			amount,
			currency,
			reference_tag
		) values (
			p_company_id,
			v_order_id,
			p_payment_method,
			'pending',
			v_total_price,
			'UAH',
			'#' || v_order_number
		);
	end if;

	-- =========================================================================
	-- 10. CLEAR CART
	-- =========================================================================
	delete from public.cart_items where cart_id = p_cart_id;

	update public.carts
	set total_price = 0, updated_at = now()
	where id = p_cart_id;

	-- =========================================================================
	-- 11. RETURN SUCCESS
	-- =========================================================================
	return jsonb_build_object(
		'order_id', v_order_id,
		'order_number', v_order_number,
		'tracking_token', v_tracking_token,
		'total_price', v_total_price,
		'delivery_id', v_delivery_id,
		'success', true,
		'idempotent', false
	);

exception
	when others then
		raise;
end;
$$;

comment on function create_order_secure is
	'Atomic order creation with customer linking (phone-first, auth.users-based), '
	'price list resolution (including group price lists), '
	'inventory locking via FOR UPDATE, idempotency support, and all-or-nothing transaction '
	'(order, items, stock, delivery, payment, cart clear). '
	'Security: verifies p_user_id = auth.uid(), reads verified email/phone from auth.users. '
	'Error codes: VALIDATION_ERROR, CART_MISMATCH, CART_EMPTY, PRODUCT_NOT_FOUND, PRODUCT_INACTIVE, PRICE_CHANGED, INSUFFICIENT_STOCK';

-- ----------------------------------------------------------------------------
-- Function: update_order_items_secure (final version from 068)
-- SECURITY DEFINER. Atomic order item replacement with:
--   - is_final flag check (not hardcoded status codes)
--   - Old inventory restoration + new inventory deduction
--   - Price resolution via resolve_product_price() with full hierarchy
--   - Stock validation with FOR UPDATE locking
-- Improvement: search_path hardened from 'public' to ''. All table
-- references fully qualified.
-- ----------------------------------------------------------------------------

create or replace function update_order_items_secure(
	p_order_id uuid,
	p_company_id uuid,
	p_customer_id uuid default null,
	p_comment text default null,
	p_new_items jsonb default '[]'::jsonb
) returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_order record;
	v_is_final boolean;
	v_status_code text;
	v_customer_price_list_id uuid;
	v_group_price_list_id uuid;
	v_default_price_list_id uuid;
	v_total_price numeric(10, 2) := 0;
	v_old_item record;
	v_new_item record;
	v_product record;
	v_resolved_price_result jsonb;
	v_resolved_price numeric;
	v_submitted_price numeric;
	v_price_source text;
	v_items_processed integer := 0;
	v_validated_items jsonb := '[]'::jsonb;
	v_items_array jsonb;
begin
	-- =========================================================================
	-- 0. PARSE INPUT — handle both string and array inputs
	-- =========================================================================
	if jsonb_typeof(p_new_items) = 'string' then
		v_items_array := (p_new_items #>> '{}')::jsonb;
	else
		v_items_array := p_new_items;
	end if;

	-- =========================================================================
	-- 1. VALIDATE ORDER EXISTS AND IS EDITABLE
	-- =========================================================================
	select
		o.id,
		o.company_id,
		o.customer_id,
		cs.code as status_code,
		coalesce(cs.is_final, false) as is_final
	into v_order
	from public.orders o
	left join public.company_statuses cs on cs.id = o.status_id
	where o.id = p_order_id;

	if not found then
		raise exception 'ORDER_NOT_FOUND:Order does not exist';
	end if;

	if v_order.company_id != p_company_id then
		raise exception 'ORDER_NOT_FOUND:Order does not belong to company';
	end if;

	if not public.has_company_permission(p_company_id, 'orders:edit', (select auth.uid())) then
		raise exception 'PERMISSION_DENIED:User does not have permission to edit orders';
	end if;

	if v_order.is_final then
		v_status_code := v_order.status_code;
		raise exception 'ORDER_NOT_EDITABLE:%:Order cannot be modified in % status',
			v_status_code, v_status_code;
	end if;

	-- =========================================================================
	-- 2. GET CUSTOMER AND PRICE LIST INFO
	-- =========================================================================
	if p_customer_id is not null then
		select cc.price_list_id, cg.price_list_id
		into v_customer_price_list_id, v_group_price_list_id
		from public.company_customers cc
		left join public.customer_groups cg on cg.id = cc.group_id
		where cc.id = p_customer_id and cc.company_id = p_company_id;
	elsif v_order.customer_id is not null then
		select cc.price_list_id, cg.price_list_id
		into v_customer_price_list_id, v_group_price_list_id
		from public.company_customers cc
		left join public.customer_groups cg on cg.id = cc.group_id
		where cc.id = v_order.customer_id;
	end if;

	select id into v_default_price_list_id
	from public.price_lists
	where company_id = p_company_id
	  and is_default = true
	  and is_active = true;

	-- =========================================================================
	-- 3. RESTORE INVENTORY FROM OLD ITEMS
	-- =========================================================================
	for v_old_item in
		select oi.product_id, oi.quantity
		from public.order_items oi
		where oi.order_id = p_order_id
		order by oi.product_id
	loop
		update public.products
		set stock_quantity = stock_quantity + v_old_item.quantity,
		    updated_at = now()
		where id = v_old_item.product_id
		  and track_inventory = true;
	end loop;

	delete from public.order_items where order_id = p_order_id;

	-- =========================================================================
	-- 4. VALIDATE AND PROCESS NEW ITEMS
	-- =========================================================================
	if v_items_array is null or jsonb_array_length(v_items_array) = 0 then
		v_total_price := 0;
	else
		for v_new_item in
			select
				(item ->> 'product_id')::uuid as product_id,
				(item ->> 'quantity')::integer as quantity,
				(item ->> 'price')::numeric as submitted_price
			from jsonb_array_elements(v_items_array) as item
			order by (item ->> 'product_id')::uuid
		loop
			select
				p.id,
				p.name,
				p.price as base_price,
				p.stock_quantity,
				p.track_inventory,
				p.company_id as product_company_id,
				cs.code as status_code
			into v_product
			from public.products p
			left join public.company_statuses cs on cs.id = p.status_id
			where p.id = v_new_item.product_id
			for update of p;

			if v_product.id is null then
				raise exception 'PRODUCT_NOT_FOUND:%:Product not found', v_new_item.product_id;
			end if;

			if v_product.product_company_id != p_company_id then
				raise exception 'PRODUCT_NOT_FOUND:%:Product does not belong to company',
					v_new_item.product_id;
			end if;

			if v_product.status_code is not null and v_product.status_code != 'active' then
				raise exception 'PRODUCT_INACTIVE:%:%', v_product.name,
					'Product is no longer available';
			end if;

			v_resolved_price_result := public.resolve_product_price(
				v_new_item.product_id,
				p_company_id,
				coalesce(p_customer_id, v_order.customer_id),
				v_customer_price_list_id,
				v_group_price_list_id,
				v_default_price_list_id,
				v_product.base_price
			);

			v_resolved_price := (v_resolved_price_result ->> 'price')::numeric;
			v_price_source := v_resolved_price_result ->> 'source';
			v_submitted_price := v_new_item.submitted_price;

			if abs(v_resolved_price - v_submitted_price) > 0.01 then
				raise exception 'PRICE_CHANGED:%:%:%',
					v_product.name,
					v_submitted_price::text,
					v_resolved_price::text;
			end if;

			if v_product.track_inventory and v_product.stock_quantity < v_new_item.quantity then
				raise exception 'INSUFFICIENT_STOCK:%:%:%',
					v_product.name,
					v_new_item.quantity::text,
					v_product.stock_quantity::text;
			end if;

			v_total_price := v_total_price + (v_resolved_price * v_new_item.quantity);

			v_validated_items := v_validated_items || jsonb_build_object(
				'product_id', v_new_item.product_id,
				'quantity', v_new_item.quantity,
				'price', v_resolved_price,
				'price_source', v_price_source
			);

			v_items_processed := v_items_processed + 1;
		end loop;
	end if;

	-- =========================================================================
	-- 5. INSERT NEW ORDER ITEMS AND REDUCE STOCK
	-- =========================================================================
	for v_new_item in select * from jsonb_array_elements(v_validated_items)
	loop
		insert into public.order_items (
			company_id,
			order_id,
			product_id,
			quantity,
			price
		) values (
			p_company_id,
			p_order_id,
			(v_new_item.value ->> 'product_id')::uuid,
			(v_new_item.value ->> 'quantity')::integer,
			(v_new_item.value ->> 'price')::numeric
		);

		update public.products
		set stock_quantity = stock_quantity - (v_new_item.value ->> 'quantity')::integer,
		    updated_at = now()
		where id = (v_new_item.value ->> 'product_id')::uuid
		  and track_inventory = true;
	end loop;

	-- =========================================================================
	-- 6. UPDATE ORDER
	-- =========================================================================
	update public.orders
	set
		total_price = v_total_price,
		customer_id = coalesce(p_customer_id, customer_id),
		comment = coalesce(p_comment, comment),
		updated_at = now()
	where id = p_order_id;

	-- =========================================================================
	-- 7. RETURN SUCCESS
	-- =========================================================================
	return jsonb_build_object(
		'order_id', p_order_id,
		'total_price', v_total_price,
		'items_count', v_items_processed,
		'success', true
	);

exception
	when others then
		raise;
end;
$$;

comment on function update_order_items_secure is
	'Atomic order item update with price list resolution (including group price lists), '
	'inventory adjustment (restore old, deduct new), and price validation. '
	'Uses is_final flag instead of hardcoded status codes. '
	'Error codes: ORDER_NOT_FOUND, ORDER_NOT_EDITABLE, PRODUCT_NOT_FOUND, '
	'PRODUCT_INACTIVE, PRICE_CHANGED, INSUFFICIENT_STOCK';

-- ----------------------------------------------------------------------------
-- Function: get_order_by_tracking_token (from 024)
-- SECURITY DEFINER. Returns full order details by tracking token for guest
-- order tracking. Includes status, company, delivery, and items with product
-- images.
-- Improvement: search_path hardened from 'public' to ''. All table references
-- fully qualified.
-- ----------------------------------------------------------------------------

create or replace function get_order_by_tracking_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_order jsonb;
begin
	select jsonb_build_object(
		'id', o.id,
		'order_number', o.order_number,
		'total_price', o.total_price,
		'payment_status', o.payment_status,
		'payment_method', o.payment_method,
		'customer_name', o.customer_name,
		'customer_email', o.customer_email,
		'customer_phone', o.customer_phone,
		'notes', o.notes,
		'tracking_token', o.tracking_token,
		'created_at', o.created_at,
		'updated_at', o.updated_at,
		'status', jsonb_build_object(
			'id', cs.id,
			'name', cs.name,
			'code', cs.code,
			'color', cs.color,
			'icon', cs.icon
		),
		'company', jsonb_build_object(
			'id', c.id,
			'name', c.name,
			'slug', c.slug,
			'logo_url', c.logo_url
		),
		'delivery', (
			select jsonb_build_object(
				'method', od.method,
				'sub_type', od.sub_type,
				'provider', od.provider,
				'city_name', od.city_name,
				'warehouse_name', od.warehouse_name,
				'warehouse_address', od.warehouse_address,
				'street', od.street,
				'building', od.building,
				'apartment', od.apartment,
				'pickup_point_name', od.pickup_point_name,
				'pickup_address', od.pickup_address,
				'tracking_number', od.tracking_number,
				'status', od.status
			)
			from public.order_deliveries od
			where od.order_id = o.id
			limit 1
		),
		'order_items', (
			select jsonb_agg(
				jsonb_build_object(
					'id', oi.id,
					'quantity', oi.quantity,
					'price', oi.price,
					'product', jsonb_build_object(
						'id', p.id,
						'name', p.name,
						'image_url', (
							select pi.image_url
							from public.product_images pi
							where pi.product_id = p.id and pi.is_primary = true
							limit 1
						)
					)
				)
			)
			from public.order_items oi
			inner join public.products p on p.id = oi.product_id
			where oi.order_id = o.id
		)
	) into v_order
	from public.orders o
	left join public.company_statuses cs on cs.id = o.status_id
	inner join public.companies c on c.id = o.company_id
	where o.tracking_token = p_token;

	return v_order;
end;
$$;

comment on function get_order_by_tracking_token(uuid) is
	'Returns full order details by tracking token for guest order tracking. '
	'Includes status, company, delivery info, and order items with product images.';

-- ############################################################################
-- PART 2: GRANTS
-- ############################################################################

grant execute on function create_order_secure to authenticated;
grant execute on function update_order_items_secure to authenticated;
grant execute on function get_order_by_tracking_token to anon, authenticated;
