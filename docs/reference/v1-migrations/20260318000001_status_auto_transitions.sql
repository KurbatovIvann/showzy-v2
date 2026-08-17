-- ============================================================================
-- Migration: status_auto_transitions
-- Description: Adds automatic status transitions triggered by payment/delivery
--              changes, transition validation enforcement, and product status
--              transitions. Includes template tables, company-level rules,
--              trigger functions, backfill for existing companies, and updated
--              create_default_company_data() function.
-- Dependencies: status_system, orders, delivery, companies
-- ============================================================================

-- ############################################################################
-- PART 1: TEMPLATE AUTO-TRANSITIONS (read-only seed data)
-- ############################################################################

create table if not exists status_template_auto_transitions (
	id               uuid default gen_random_uuid() primary key,
	template_id      uuid not null references status_templates (id) on delete cascade,
	trigger_field    text not null check (trigger_field in ('payment_status', 'delivery_status')),
	trigger_value    text not null,
	condition_field  text check (condition_field in ('payment_status', 'delivery_status')),
	condition_value  text,
	from_status_code text not null,
	to_status_code   text not null,

	constraint status_template_auto_transitions_unique
		unique (template_id, trigger_field, trigger_value, from_status_code),
	constraint status_template_auto_transitions_condition_pair
		check ((condition_field is null) = (condition_value is null))
);

comment on table status_template_auto_transitions is 'Auto-transition rules within a status template';

create index idx_status_template_auto_transitions_template
	on status_template_auto_transitions (template_id);

alter table status_template_auto_transitions enable row level security;
alter table status_template_auto_transitions force row level security;

create policy "status_template_auto_transitions: public read"
	on status_template_auto_transitions
	for select
	to anon, authenticated
	using (true);

-- ############################################################################
-- PART 2: COMPANY AUTO-TRANSITIONS
-- ############################################################################

create table if not exists status_auto_transitions (
	id              uuid        default gen_random_uuid() primary key,
	company_id      uuid        not null references companies (id) on delete cascade,
	trigger_field   text        not null check (trigger_field in ('payment_status', 'delivery_status')),
	trigger_value   text        not null,
	condition_field text        check (condition_field in ('payment_status', 'delivery_status')),
	condition_value text,
	from_status_id  uuid        not null references company_statuses (id) on delete cascade,
	to_status_id    uuid        not null references company_statuses (id) on delete cascade,
	is_active       boolean     default true,
	created_at      timestamptz default now(),

	constraint status_auto_transitions_unique
		unique (company_id, trigger_field, trigger_value, from_status_id),
	constraint status_auto_transitions_condition_pair
		check ((condition_field is null) = (condition_value is null))
);

comment on table  status_auto_transitions                is 'Configurable rules that auto-advance order status on payment/delivery changes';
comment on column status_auto_transitions.trigger_field  is 'Which field triggers the auto-transition (payment_status or delivery_status)';
comment on column status_auto_transitions.trigger_value  is 'Value that the trigger_field must change to (e.g. paid, delivered)';
comment on column status_auto_transitions.condition_field is 'Optional additional field that must also match for the rule to fire';
comment on column status_auto_transitions.condition_value is 'Required value of condition_field for the rule to fire';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index idx_status_auto_transitions_company
	on status_auto_transitions (company_id);

create index idx_status_auto_transitions_lookup
	on status_auto_transitions (company_id, trigger_field, trigger_value, from_status_id)
	where is_active = true;

-- ----------------------------------------------------------------------------
-- RLS — public read + member write (consistent with status_transitions)
-- ----------------------------------------------------------------------------

alter table status_auto_transitions enable row level security;
alter table status_auto_transitions force row level security;

create policy "status_auto_transitions: public read"
	on status_auto_transitions
	for select
	using (true);

create policy "status_auto_transitions: member insert"
	on status_auto_transitions
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "status_auto_transitions: member update"
	on status_auto_transitions
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "status_auto_transitions: member delete"
	on status_auto_transitions
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

-- ############################################################################
-- PART 3: SEED TEMPLATE DATA
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Product status transitions (general_product had none)
-- ----------------------------------------------------------------------------

insert into status_template_transitions (template_id, from_status_code, to_status_code)
select id, 'active', 'inactive' from status_templates where code = 'general_product'
union all
select id, 'active', 'archived' from status_templates where code = 'general_product'
union all
select id, 'inactive', 'active' from status_templates where code = 'general_product'
union all
select id, 'inactive', 'archived' from status_templates where code = 'general_product'
on conflict (template_id, from_status_code, to_status_code) do nothing;

-- ----------------------------------------------------------------------------
-- Auto-transition template rules for all order templates
-- Pattern: when BOTH paid AND delivered while at the pre-final status → complete
-- ----------------------------------------------------------------------------

-- General order: confirmed → completed
insert into status_template_auto_transitions
	(template_id, trigger_field, trigger_value, condition_field, condition_value, from_status_code, to_status_code)
select id, 'payment_status', 'paid', 'delivery_status', 'delivered', 'confirmed', 'completed'
	from status_templates where code = 'general_order'
union all
select id, 'delivery_status', 'delivered', 'payment_status', 'paid', 'confirmed', 'completed'
	from status_templates where code = 'general_order'
on conflict (template_id, trigger_field, trigger_value, from_status_code) do nothing;

-- Bakery order: ready → delivered
insert into status_template_auto_transitions
	(template_id, trigger_field, trigger_value, condition_field, condition_value, from_status_code, to_status_code)
select id, 'payment_status', 'paid', 'delivery_status', 'delivered', 'ready', 'delivered'
	from status_templates where code = 'bakery_order'
union all
select id, 'delivery_status', 'delivered', 'payment_status', 'paid', 'ready', 'delivered'
	from status_templates where code = 'bakery_order'
on conflict (template_id, trigger_field, trigger_value, from_status_code) do nothing;

-- Beauty order: in_progress → completed
insert into status_template_auto_transitions
	(template_id, trigger_field, trigger_value, condition_field, condition_value, from_status_code, to_status_code)
select id, 'payment_status', 'paid', 'delivery_status', 'delivered', 'in_progress', 'completed'
	from status_templates where code = 'beauty_order'
union all
select id, 'delivery_status', 'delivered', 'payment_status', 'paid', 'in_progress', 'completed'
	from status_templates where code = 'beauty_order'
on conflict (template_id, trigger_field, trigger_value, from_status_code) do nothing;

-- Artisan order: shipped → delivered
insert into status_template_auto_transitions
	(template_id, trigger_field, trigger_value, condition_field, condition_value, from_status_code, to_status_code)
select id, 'payment_status', 'paid', 'delivery_status', 'delivered', 'shipped', 'delivered'
	from status_templates where code = 'artisan_order'
union all
select id, 'delivery_status', 'delivered', 'payment_status', 'paid', 'shipped', 'delivered'
	from status_templates where code = 'artisan_order'
on conflict (template_id, trigger_field, trigger_value, from_status_code) do nothing;

-- Restaurant order: out_for_delivery → delivered
insert into status_template_auto_transitions
	(template_id, trigger_field, trigger_value, condition_field, condition_value, from_status_code, to_status_code)
select id, 'payment_status', 'paid', 'delivery_status', 'delivered', 'out_for_delivery', 'delivered'
	from status_templates where code = 'restaurant_order'
union all
select id, 'delivery_status', 'delivered', 'payment_status', 'paid', 'out_for_delivery', 'delivered'
	from status_templates where code = 'restaurant_order'
on conflict (template_id, trigger_field, trigger_value, from_status_code) do nothing;

-- ############################################################################
-- PART 4: TRIGGER FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: auto_transition_on_payment_change
-- BEFORE UPDATE on orders. When payment_status changes (and status_id was not
-- also manually changed), looks up an auto-transition rule and sets status_id.
-- Fires alphabetically before validate_order_status_transition.
-- ----------------------------------------------------------------------------

create or replace function auto_transition_on_payment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_target_status_id uuid;
	v_delivery_status  text;
begin
	if old.payment_status is distinct from new.payment_status
	   and old.status_id is not distinct from new.status_id then

		select d.status::text into v_delivery_status
		from public.order_deliveries d
		where d.order_id = new.id
		limit 1;

		select sat.to_status_id into v_target_status_id
		from public.status_auto_transitions sat
		where sat.company_id = new.company_id
		  and sat.trigger_field = 'payment_status'
		  and sat.trigger_value = new.payment_status
		  and sat.from_status_id = new.status_id
		  and sat.is_active = true
		  and (sat.condition_field is null
		       or (sat.condition_field = 'delivery_status'
		           and sat.condition_value = v_delivery_status));

		if v_target_status_id is not null then
			new.status_id := v_target_status_id;
		end if;
	end if;

	return new;
end;
$$;

comment on function auto_transition_on_payment_change() is
	'Auto-advances order status when payment_status changes and conditions are met';

-- ----------------------------------------------------------------------------
-- Function: validate_order_status_transition
-- BEFORE UPDATE on orders. Enforces that status_id changes follow the allowed
-- transitions in status_transitions. Skips if old or new status_id is NULL.
-- ----------------------------------------------------------------------------

create or replace function validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if old.status_id is not null
	   and new.status_id is not null
	   and old.status_id is distinct from new.status_id then
		if not exists (
			select 1 from public.status_transitions
			where company_id = new.company_id
			  and from_status_id = old.status_id
			  and to_status_id = new.status_id
		) then
			raise exception 'Invalid status transition'
				using errcode = 'P0001';
		end if;
	end if;

	return new;
end;
$$;

comment on function validate_order_status_transition() is
	'Enforces allowed status transitions for orders based on status_transitions table';

-- ----------------------------------------------------------------------------
-- Function: auto_transition_on_delivery_change
-- AFTER UPDATE on order_deliveries. When delivery status changes, looks up an
-- auto-transition rule and updates orders.status_id.
-- ----------------------------------------------------------------------------

create or replace function auto_transition_on_delivery_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_target_status_id uuid;
	v_order            record;
begin
	if old.status is distinct from new.status then
		select o.status_id, o.payment_status, o.company_id
		into v_order
		from public.orders o
		where o.id = new.order_id;

		if v_order.status_id is not null then
			select sat.to_status_id into v_target_status_id
			from public.status_auto_transitions sat
			where sat.company_id = v_order.company_id
			  and sat.trigger_field = 'delivery_status'
			  and sat.trigger_value = new.status::text
			  and sat.from_status_id = v_order.status_id
			  and sat.is_active = true
			  and (sat.condition_field is null
			       or (sat.condition_field = 'payment_status'
			           and sat.condition_value = v_order.payment_status));

			if v_target_status_id is not null then
				update public.orders
				set status_id = v_target_status_id
				where id = new.order_id;
			end if;
		end if;
	end if;

	return new;
end;
$$;

comment on function auto_transition_on_delivery_change() is
	'Auto-advances order status when delivery status changes and conditions are met';

-- ############################################################################
-- PART 5: TRIGGERS
-- ############################################################################

-- Alphabetical trigger name ordering ensures correct execution sequence:
-- 1. auto_transition_on_payment_change (a...) — may modify new.status_id
-- 2. orders_update_timestamp (o...) — updates updated_at (existing)
-- 3. validate_order_status_transition (v...) — validates final status_id

create trigger auto_transition_on_payment_change
	before update on orders
	for each row
	execute function auto_transition_on_payment_change();

create trigger validate_order_status_transition
	before update on orders
	for each row
	execute function validate_order_status_transition();

create trigger order_deliveries_auto_transition
	after update on order_deliveries
	for each row
	execute function auto_transition_on_delivery_change();

-- ############################################################################
-- PART 6: UPDATED create_default_company_data()
-- Now also creates: product transitions, order auto-transitions.
-- ############################################################################

create or replace function create_default_company_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_status_map         jsonb := '{}';
	v_product_status_map jsonb := '{}';
	v_item               record;
	v_transition         record;
	v_auto               record;
	v_new_status_id      uuid;
begin
	-- Unit types
	insert into public.unit_types (company_id, code, name, symbol, is_default, sort_order)
	values
		(new.id, 'piece', 'Piece', 'pc', true, 1),
		(new.id, 'kg', 'Kilogram', 'kg', false, 2),
		(new.id, 'g', 'Gram', 'g', false, 3),
		(new.id, 'l', 'Liter', 'L', false, 4),
		(new.id, 'ml', 'Milliliter', 'ml', false, 5),
		(new.id, 'm', 'Meter', 'm', false, 6),
		(new.id, 'pack', 'Pack', 'pack', false, 7);

	-- Product statuses
	for v_item in
		select sti.code, sti.name, sti.color, sti.icon, sti.sort_order, sti.is_default, sti.is_final
		from public.status_template_items sti
		join public.status_templates st on st.id = sti.template_id
		where st.code = 'general_product'
		order by sti.sort_order
	loop
		insert into public.company_statuses (company_id, entity_type, code, name, color, icon, sort_order, is_default, is_final)
		values (new.id, 'product', v_item.code, v_item.name, v_item.color, v_item.icon, v_item.sort_order, v_item.is_default, v_item.is_final)
		returning id into v_new_status_id;

		v_product_status_map := v_product_status_map || jsonb_build_object(v_item.code, v_new_status_id);
	end loop;

	-- Product transitions
	for v_transition in
		select stt.from_status_code, stt.to_status_code
		from public.status_template_transitions stt
		join public.status_templates st on st.id = stt.template_id
		where st.code = 'general_product'
	loop
		insert into public.status_transitions (company_id, from_status_id, to_status_id)
		values (
			new.id,
			(v_product_status_map ->> v_transition.from_status_code)::uuid,
			(v_product_status_map ->> v_transition.to_status_code)::uuid
		);
	end loop;

	-- Order statuses
	for v_item in
		select sti.code, sti.name, sti.color, sti.icon, sti.sort_order, sti.is_default, sti.is_final
		from public.status_template_items sti
		join public.status_templates st on st.id = sti.template_id
		where st.code = 'general_order'
		order by sti.sort_order
	loop
		insert into public.company_statuses (company_id, entity_type, code, name, color, icon, sort_order, is_default, is_final)
		values (new.id, 'order', v_item.code, v_item.name, v_item.color, v_item.icon, v_item.sort_order, v_item.is_default, v_item.is_final)
		returning id into v_new_status_id;

		v_status_map := v_status_map || jsonb_build_object(v_item.code, v_new_status_id);
	end loop;

	-- Order transitions
	for v_transition in
		select stt.from_status_code, stt.to_status_code
		from public.status_template_transitions stt
		join public.status_templates st on st.id = stt.template_id
		where st.code = 'general_order'
	loop
		insert into public.status_transitions (company_id, from_status_id, to_status_id)
		values (
			new.id,
			(v_status_map ->> v_transition.from_status_code)::uuid,
			(v_status_map ->> v_transition.to_status_code)::uuid
		);
	end loop;

	-- Order auto-transitions
	for v_auto in
		select stat.trigger_field, stat.trigger_value,
		       stat.condition_field, stat.condition_value,
		       stat.from_status_code, stat.to_status_code
		from public.status_template_auto_transitions stat
		join public.status_templates st on st.id = stat.template_id
		where st.code = 'general_order'
	loop
		insert into public.status_auto_transitions
			(company_id, trigger_field, trigger_value, condition_field, condition_value, from_status_id, to_status_id)
		values (
			new.id,
			v_auto.trigger_field,
			v_auto.trigger_value,
			v_auto.condition_field,
			v_auto.condition_value,
			(v_status_map ->> v_auto.from_status_code)::uuid,
			(v_status_map ->> v_auto.to_status_code)::uuid
		);
	end loop;

	return new;
end;
$$;

comment on function create_default_company_data() is
	'Creates default unit types, statuses, transitions, and auto-transition rules when a new company is created';

-- ############################################################################
-- PART 7: BACKFILL EXISTING COMPANIES
-- ############################################################################

-- Order auto-transition rules: payment_status → paid (while confirmed + delivered) → completed
insert into status_auto_transitions (company_id, trigger_field, trigger_value, condition_field, condition_value, from_status_id, to_status_id)
select
	cs_from.company_id,
	'payment_status',
	'paid',
	'delivery_status',
	'delivered',
	cs_from.id,
	cs_to.id
from company_statuses cs_from
join company_statuses cs_to
	on cs_to.company_id = cs_from.company_id
	and cs_to.entity_type = 'order'
	and cs_to.code = 'completed'
where cs_from.entity_type = 'order'
  and cs_from.code = 'confirmed'
on conflict (company_id, trigger_field, trigger_value, from_status_id) do nothing;

-- Order auto-transition rules: delivery_status → delivered (while confirmed + paid) → completed
insert into status_auto_transitions (company_id, trigger_field, trigger_value, condition_field, condition_value, from_status_id, to_status_id)
select
	cs_from.company_id,
	'delivery_status',
	'delivered',
	'payment_status',
	'paid',
	cs_from.id,
	cs_to.id
from company_statuses cs_from
join company_statuses cs_to
	on cs_to.company_id = cs_from.company_id
	and cs_to.entity_type = 'order'
	and cs_to.code = 'completed'
where cs_from.entity_type = 'order'
  and cs_from.code = 'confirmed'
on conflict (company_id, trigger_field, trigger_value, from_status_id) do nothing;

-- Product transitions for existing companies (were never created)
insert into status_transitions (company_id, from_status_id, to_status_id)
select cs_from.company_id, cs_from.id, cs_to.id
from company_statuses cs_from
join company_statuses cs_to
	on cs_to.company_id = cs_from.company_id
	and cs_to.entity_type = 'product'
where cs_from.entity_type = 'product'
  and (
	(cs_from.code = 'active'   and cs_to.code = 'inactive')
	or (cs_from.code = 'active'   and cs_to.code = 'archived')
	or (cs_from.code = 'inactive' and cs_to.code = 'active')
	or (cs_from.code = 'inactive' and cs_to.code = 'archived')
  )
on conflict (company_id, from_status_id, to_status_id) do nothing;
