-- ============================================================================
-- Migration: order_policies_and_operations
-- Description: Customer cancel RLS, drop obsolete delete policies, extended
--              outbox triggers, and create_company_order RPC.
-- Consolidates: 0323 + 0324 + 0325 + 0326
-- Dependencies: orders (012), company_customers (008), company_statuses (006),
--               domain_events (20260309000002), order_deliveries (014),
--               resolve_product_price (008), has_company_permission (005)
-- ============================================================================

-- ############################################################################
-- PART 1: CUSTOMER CANCEL ORDER RLS
-- ############################################################################

create policy "orders: customer cancel own pending"
	on orders
	for update
	to authenticated
	using (
		exists (
			select 1 from company_customers cc
			where cc.id = orders.customer_id
			  and cc.user_id = (select auth.uid())
		)
		and exists (
			select 1 from company_statuses cs
			where cs.id = orders.status_id
			  and cs.code = 'pending'
		)
		and payment_status = 'pending'
	)
	with check (
		payment_status = 'cancelled'
		and (
			status_id is null
			or exists (
				select 1 from company_statuses cs
				where cs.id = status_id
				  and cs.code = 'cancelled'
				  and cs.entity_type = 'order'
			)
		)
	);

-- ############################################################################
-- PART 2: DROP OBSOLETE DELETE POLICIES
-- ############################################################################

drop policy if exists "orders: member delete" on orders;
drop policy if exists "company_customers: member delete" on company_customers;

do $$
begin
	delete from public.role_permissions where permission in ('orders:delete', 'customers:delete');
exception
	when undefined_table then null;
end;
$$;

-- ############################################################################
-- PART 3: EXTENDED OUTBOX TRIGGERS
-- ############################################################################

create or replace function fn_orders_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('order_created', 'order', new.id, new.company_id,
		        jsonb_build_object('new', row_to_json(new)));

	elsif tg_op = 'UPDATE' then
		if old.status_id is distinct from new.status_id then
			insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
			values ('status_changed', 'order', new.id, new.company_id,
			        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));
		end if;

		if old.payment_status is distinct from new.payment_status
		   or old.payment_method is distinct from new.payment_method then
			insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
			values ('payment_changed', 'order', new.id, new.company_id,
			        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));
		end if;
	end if;

	perform pg_notify('domain_events', tg_table_name);
	return new;
end;
$$;

create or replace function fn_order_deliveries_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'UPDATE' and (
		old.status is distinct from new.status
		or old.method is distinct from new.method
		or old.sub_type is distinct from new.sub_type
		or old.city_name is distinct from new.city_name
		or old.warehouse_name is distinct from new.warehouse_name
		or old.warehouse_address is distinct from new.warehouse_address
		or old.street is distinct from new.street
		or old.building is distinct from new.building
		or old.apartment is distinct from new.apartment
		or old.pickup_point_name is distinct from new.pickup_point_name
		or old.pickup_address is distinct from new.pickup_address
	) then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('delivery_changed', 'order', new.order_id, new.company_id,
		        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));

		perform pg_notify('domain_events', 'order_deliveries');
	end if;
	return new;
end;
$$;

-- ############################################################################
-- PART 4: CREATE COMPANY ORDER RPC
-- ############################################################################

create or replace function create_company_order(
	p_company_id     uuid,
	p_customer_id    uuid    default null,
	p_status_id      uuid    default null,
	p_payment_status text    default 'pending',
	p_payment_method text    default null,
	p_comment        text    default null,
	p_items          jsonb   default '[]'::jsonb,
	p_delivery_info  jsonb   default null
) returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_order_id                uuid;
	v_order_number            text;
	v_tracking_token          uuid;
	v_total_price             numeric(10, 2) := 0;
	v_status_id               uuid;
	v_customer_price_list_id  uuid;
	v_group_price_list_id     uuid;
	v_default_price_list_id   uuid;
	v_item                    record;
	v_product                 record;
	v_resolved_price_result   jsonb;
	v_resolved_price          numeric;
	v_submitted_price         numeric;
	v_price_source            text;
	v_delivery_id             uuid;
	v_delivery_info           jsonb;
	v_customer_name           varchar(255);
	v_customer_email          varchar(255);
	v_customer_phone          varchar(50);
	v_items_processed         integer := 0;
	v_validated_items         jsonb := '[]'::jsonb;
	v_items_array             jsonb;
begin
	if not public.has_company_permission(p_company_id, 'orders:create', (select auth.uid())) then
		raise exception 'PERMISSION_DENIED:User does not have permission to create orders';
	end if;

	if p_company_id is null then
		raise exception 'VALIDATION_ERROR:Company ID is required';
	end if;

	if jsonb_typeof(p_items) = 'string' then
		v_items_array := (p_items #>> '{}')::jsonb;
	else
		v_items_array := p_items;
	end if;

	if v_items_array is null or jsonb_array_length(v_items_array) = 0 then
		raise exception 'VALIDATION_ERROR:At least one item is required';
	end if;

	if p_delivery_info is not null and jsonb_typeof(p_delivery_info) = 'string' then
		v_delivery_info := (p_delivery_info #>> '{}')::jsonb;
	else
		v_delivery_info := p_delivery_info;
	end if;

	if p_status_id is not null then
		if not exists (
			select 1 from public.company_statuses
			where id = p_status_id
			  and company_id = p_company_id
			  and entity_type = 'order'
		) then
			raise exception 'VALIDATION_ERROR:Invalid status for this company';
		end if;
		v_status_id := p_status_id;
	else
		select id into v_status_id
		from public.company_statuses
		where company_id = p_company_id
		  and entity_type = 'order'
		  and is_default = true
		limit 1;

		if v_status_id is null then
			select id into v_status_id
			from public.company_statuses
			where company_id = p_company_id
			  and entity_type = 'order'
			order by sort_order
			limit 1;
		end if;
	end if;

	if p_customer_id is not null then
		if not exists (
			select 1 from public.company_customers
			where id = p_customer_id and company_id = p_company_id
		) then
			raise exception 'VALIDATION_ERROR:Customer does not belong to this company';
		end if;

		select cc.price_list_id, cg.price_list_id, cc.name, cc.email, cc.phone
		into v_customer_price_list_id, v_group_price_list_id, v_customer_name, v_customer_email, v_customer_phone
		from public.company_customers cc
		left join public.customer_groups cg on cg.id = cc.group_id
		where cc.id = p_customer_id and cc.company_id = p_company_id;
	end if;

	select id into v_default_price_list_id
	from public.price_lists
	where company_id = p_company_id
	  and is_default = true
	  and is_active = true;

	for v_item in
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
		where p.id = v_item.product_id
		for update of p;

		if v_product.id is null then
			raise exception 'PRODUCT_NOT_FOUND:%:Product not found', v_item.product_id;
		end if;

		if v_product.product_company_id != p_company_id then
			raise exception 'PRODUCT_NOT_FOUND:%:Product does not belong to company', v_item.product_id;
		end if;

		if v_product.status_code is not null and v_product.status_code != 'active' then
			raise exception 'PRODUCT_INACTIVE:%:%', v_product.name, 'Product is no longer available';
		end if;

		v_resolved_price_result := public.resolve_product_price(
			v_item.product_id,
			p_company_id,
			p_customer_id,
			v_customer_price_list_id,
			v_group_price_list_id,
			v_default_price_list_id,
			v_product.base_price
		);

		v_resolved_price := (v_resolved_price_result ->> 'price')::numeric;
		v_price_source := v_resolved_price_result ->> 'source';
		v_submitted_price := v_item.submitted_price;

		if abs(v_resolved_price - v_submitted_price) > 0.01 then
			raise exception 'PRICE_CHANGED:%:%:%',
				v_product.name,
				v_submitted_price::text,
				v_resolved_price::text;
		end if;

		if v_product.track_inventory and v_product.stock_quantity < v_item.quantity then
			raise exception 'INSUFFICIENT_STOCK:%:%:%',
				v_product.name,
				v_item.quantity::text,
				v_product.stock_quantity::text;
		end if;

		v_total_price := v_total_price + (v_resolved_price * v_item.quantity);

		v_validated_items := v_validated_items || jsonb_build_object(
			'product_id', v_item.product_id,
			'quantity', v_item.quantity,
			'price', v_resolved_price,
			'price_source', v_price_source
		);

		v_items_processed := v_items_processed + 1;
	end loop;

	if v_items_processed = 0 then
		raise exception 'VALIDATION_ERROR:No valid items to process';
	end if;

	v_tracking_token := gen_random_uuid();

	insert into public.orders (
		company_id,
		customer_id,
		customer_name,
		customer_email,
		customer_phone,
		total_price,
		status_id,
		tracking_token,
		payment_status,
		payment_method,
		comment
	) values (
		p_company_id,
		p_customer_id,
		v_customer_name,
		v_customer_email,
		v_customer_phone,
		v_total_price,
		v_status_id,
		v_tracking_token,
		coalesce(p_payment_status, 'pending'),
		p_payment_method,
		nullif(trim(coalesce(p_comment, '')), '')
	) returning id, order_number into v_order_id, v_order_number;

	for v_item in select * from jsonb_array_elements(v_validated_items)
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

	if v_delivery_info is not null and v_delivery_info ->> 'method' is not null then
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
			(v_delivery_info ->> 'method')::public.delivery_method_type,
			nullif(v_delivery_info ->> 'sub_type', '')::public.delivery_sub_type,
			nullif(v_delivery_info ->> 'provider', ''),
			nullif(v_delivery_info ->> 'city_ref', ''),
			nullif(v_delivery_info ->> 'city_name', ''),
			nullif(v_delivery_info ->> 'warehouse_ref', ''),
			nullif(v_delivery_info ->> 'warehouse_name', ''),
			nullif(v_delivery_info ->> 'warehouse_address', ''),
			nullif(v_delivery_info ->> 'street', ''),
			nullif(v_delivery_info ->> 'building', ''),
			nullif(v_delivery_info ->> 'apartment', ''),
			nullif(v_delivery_info ->> 'pickup_point_id', ''),
			nullif(v_delivery_info ->> 'pickup_point_name', ''),
			nullif(v_delivery_info ->> 'pickup_address', ''),
			nullif(v_delivery_info ->> 'customer_notes', ''),
			'pending'
		)
		returning id into v_delivery_id;
	end if;

	insert into public.order_logs (
		order_id,
		company_id,
		action,
		new_values
	) values (
		v_order_id,
		p_company_id,
		'order_created',
		jsonb_build_object(
			'order_number', v_order_number,
			'total_price', v_total_price,
			'status_id', v_status_id,
			'payment_status', coalesce(p_payment_status, 'pending'),
			'payment_method', p_payment_method,
			'customer_id', p_customer_id,
			'items_count', v_items_processed,
			'delivery_id', v_delivery_id,
			'created_by', (select auth.uid())
		)
	);

	return jsonb_build_object(
		'order_id', v_order_id,
		'order_number', v_order_number,
		'tracking_token', v_tracking_token,
		'total_price', v_total_price,
		'delivery_id', v_delivery_id,
		'success', true
	);

exception
	when others then
		raise;
end;
$$;

comment on function create_company_order is
	'Atomic order creation for company members (panel). '
	'Permission check via has_company_permission(orders:create). '
	'Price resolution via resolve_product_price() with full hierarchy. '
	'Inventory locking via FOR UPDATE with consistent product_id ordering to prevent deadlocks. '
	'Creates order, items, stock deduction, optional delivery, and activity log in one transaction. '
	'Error codes: PERMISSION_DENIED, VALIDATION_ERROR, PRODUCT_NOT_FOUND, PRODUCT_INACTIVE, PRICE_CHANGED, INSUFFICIENT_STOCK';

grant execute on function create_company_order to authenticated;
