-- ============================================================================
-- Migration: create_company_customer_link_user
-- Description: SECURITY DEFINER RPC to link a chat participant (auth user) to
--              company_customers with email/phone copied from public.users.
--              Panel RLS blocks staff from selecting other users' rows; this
--              function enforces customers:create + an existing conversation
--              gate before reading PII (definer + empty search_path).
-- Dependencies: company_customers (008), users (004), conversations (015),
--               has_company_permission (018)
-- ============================================================================

create or replace function public.create_company_customer_link_user(
	p_company_id      uuid,
	p_user_id         uuid,
	p_name            text default null,
	p_notes           text default null,
	p_price_list_id   uuid default null,
	p_group_id        uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_actor        uuid := (select auth.uid());
	v_email        text;
	v_phone        text;
	v_u_name       text;
	v_display_name text;
	v_insert_name  text;
	v_id           uuid;
	v_out_name     text;
	v_out_email    text;
	v_out_phone    text;
begin
	if v_actor is null then
		raise exception 'PERMISSION_DENIED:Not authenticated';
	end if;

	if not public.has_company_permission(p_company_id, 'customers:create', v_actor) then
		raise exception 'PERMISSION_DENIED:You do not have permission to create customers';
	end if;

	if not exists (
		select 1
		from public.conversations c
		where c.company_id = p_company_id
		  and c.customer_user_id = p_user_id
	) then
		raise exception 'CUSTOMER_NOT_IN_CONVERSATION:This user is not a participant in any conversation with your company';
	end if;

	select u.email, u.phone, u.name, u.display_name
	into v_email, v_phone, v_u_name, v_display_name
	from public.users u
	where u.id = p_user_id;

	if not found then
		raise exception 'RESOURCE_NOT_FOUND:User not found';
	end if;

	v_email := nullif(trim(coalesce(v_email, '')), '');
	v_phone := nullif(trim(coalesce(v_phone, '')), '');

	if v_email is null and v_phone is null then
		raise exception 'USER_CONTACT_MISSING:This account has no email or phone on file. The customer can update their profile, or you can add contact details manually when creating the customer.';
	end if;

	v_insert_name := nullif(trim(coalesce(p_name, '')), '');
	if v_insert_name is null then
		v_insert_name := coalesce(
			nullif(trim(coalesce(v_display_name, '')), ''),
			nullif(trim(coalesce(v_u_name, '')), ''),
			'Customer'
		);
	end if;

	insert into public.company_customers as cc (
		company_id,
		user_id,
		name,
		email,
		phone,
		notes,
		price_list_id,
		group_id
	) values (
		p_company_id,
		p_user_id,
		v_insert_name,
		v_email,
		v_phone,
		nullif(trim(coalesce(p_notes, '')), ''),
		p_price_list_id,
		p_group_id
	)
	on conflict (company_id, user_id) do update set
		name = excluded.name,
		email = excluded.email,
		phone = excluded.phone,
		notes = coalesce(excluded.notes, cc.notes),
		price_list_id = coalesce(excluded.price_list_id, cc.price_list_id),
		group_id = coalesce(excluded.group_id, cc.group_id),
		updated_at = now()
	returning cc.id, cc.name, cc.email, cc.phone
	into v_id, v_out_name, v_out_email, v_out_phone;

	return jsonb_build_object(
		'id', v_id,
		'name', v_out_name,
		'email', v_out_email,
		'phone', v_out_phone
	);
end;
$$;

comment on function public.create_company_customer_link_user is
	'Creates or updates a company_customer for a user_id, copying email/phone from public.users. '
	'Caller must have customers:create and the user must appear as customer_user_id on a conversation for the company.';

grant execute on function public.create_company_customer_link_user to authenticated;
revoke execute on function public.create_company_customer_link_user from anon, public;
