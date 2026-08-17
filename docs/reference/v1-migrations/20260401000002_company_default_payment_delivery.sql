-- ============================================================================
-- Migration: company_default_payment_delivery
-- Description: Extends create_default_company_data() to seed a payment_settings
--              row (cash_on_delivery enabled) and a company_delivery_methods row
--              (nova_poshta enabled) for every new company. Adds a trigger on
--              company_legal_info that auto-enables bank_transfer when valid
--              banking info (IBAN + legal name) is provided.
-- Dependencies: status_auto_transitions (20260318000001),
--               payments (20260301000013),
--               delivery (20260301000014),
--               company_legal_info (20260320000004)
-- ============================================================================

-- ############################################################################
-- PART 1: UPDATED create_default_company_data()
-- Now also creates: payment_settings, company_delivery_methods (nova_poshta).
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

	-- Payment settings (cash on delivery enabled by default)
	insert into public.payment_settings (company_id, enabled_methods)
	values (new.id, array['cash_on_delivery']);

	-- Nova Poshta delivery (enabled by default for all companies)
	insert into public.company_delivery_methods (company_id, method, is_enabled, display_order, config)
	values (
		new.id,
		'nova_poshta',
		true,
		1,
		'{"allowed_sub_types": ["warehouse", "poshtomat", "courier"]}'::jsonb
	);

	return new;
end;
$$;

comment on function create_default_company_data() is
	'Creates default unit types, statuses, transitions, auto-transition rules, payment settings, and delivery methods when a new company is created';

-- ############################################################################
-- PART 2: AUTO-ENABLE bank_transfer ON VALID LEGAL INFO
-- ############################################################################

create or replace function auto_enable_bank_transfer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.iban is not null
	   and new.iban ~ '^UA\d{27}$'
	   and new.legal_name is not null
	   and new.legal_name <> ''
	then
		update public.payment_settings
		set enabled_methods = case
				when 'bank_transfer' = any(enabled_methods) then enabled_methods
				else array_append(enabled_methods, 'bank_transfer')
			end,
			updated_at = now()
		where company_id = new.company_id;
	end if;

	return new;
end;
$$;

comment on function auto_enable_bank_transfer() is
	'Automatically adds bank_transfer to payment_settings.enabled_methods when company_legal_info has a valid IBAN and legal name';

create trigger auto_enable_bank_transfer_trigger
	after insert or update on public.company_legal_info
	for each row
	execute function auto_enable_bank_transfer();
