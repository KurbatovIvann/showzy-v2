-- ============================================================================
-- Migration: invite_accept_auto_conversation
-- Description: When a customer accepts an invite, auto-create an active
--              conversation between the company and the customer (if one
--              does not already exist). The existing trigger
--              create_conversation_participants fires on INSERT to create
--              participant records automatically.
-- Dependencies: 20260331000003_company_customer_invites,
--               20260301000015_messaging,
--               20260401000006_conversation_draft_status
-- ============================================================================

create or replace function public.accept_company_customer_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_actor        uuid := (select auth.uid());
	v_invite       record;
	v_user         record;
	v_cc_id        uuid;
	v_slug         text;
	v_insert_name  text;
begin
	if v_actor is null then
		raise exception 'PERMISSION_DENIED:Not authenticated';
	end if;

	-- Lock the invite row to prevent race conditions
	select
		i.id, i.company_id, i.group_id, i.price_list_id,
		i.status, i.is_reusable, i.max_uses, i.uses_count,
		i.expires_at, i.email, i.phone, i.name
	into v_invite
	from public.company_customer_invites i
	where i.token = p_token
	for update;

	if not found then
		raise exception 'INVITE_INVALID:This invite link is not valid';
	end if;

	if v_invite.status = 'revoked' then
		raise exception 'INVITE_INVALID:This invite link is not valid';
	end if;

	if v_invite.status = 'expired' or v_invite.expires_at <= now() then
		raise exception 'INVITE_EXPIRED:This invite has expired';
	end if;

	if v_invite.status = 'accepted' then
		raise exception 'INVITE_ALREADY_ACCEPTED:This invite has already been used';
	end if;

	if not v_invite.is_reusable and v_invite.uses_count >= 1 then
		raise exception 'INVITE_ALREADY_ACCEPTED:This invite has already been used';
	end if;

	if v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses then
		raise exception 'INVITE_MAX_USES_REACHED:This invite link has reached its maximum number of uses';
	end if;

	-- Check if user already accepted this specific invite
	if exists (
		select 1 from public.company_customers cc
		where cc.company_id = v_invite.company_id
		  and cc.user_id = v_actor
		  and cc.invite_id = v_invite.id
	) then
		raise exception 'INVITE_ALREADY_MEMBER:You have already accepted this invite';
	end if;

	-- Get user info for the company_customer record
	select u.email, u.phone, u.name, u.display_name
	into v_user
	from public.users u
	where u.id = v_actor;

	if not found then
		raise exception 'RESOURCE_NOT_FOUND:User not found';
	end if;

	-- Resolve the name to use
	v_insert_name := nullif(trim(coalesce(v_invite.name, '')), '');
	if v_insert_name is null then
		v_insert_name := coalesce(
			nullif(trim(coalesce(v_user.display_name, '')), ''),
			nullif(trim(coalesce(v_user.name, '')), ''),
			'Customer'
		);
	end if;

	-- Upsert company_customer
	insert into public.company_customers as cc (
		company_id,
		user_id,
		name,
		email,
		phone,
		group_id,
		price_list_id,
		invite_id
	) values (
		v_invite.company_id,
		v_actor,
		v_insert_name,
		coalesce(
			nullif(trim(coalesce(v_invite.email, '')), ''),
			nullif(trim(coalesce(v_user.email, '')), '')
		),
		coalesce(
			nullif(trim(coalesce(v_invite.phone, '')), ''),
			nullif(trim(coalesce(v_user.phone, '')), '')
		),
		v_invite.group_id,
		v_invite.price_list_id,
		v_invite.id
	)
	on conflict (company_id, user_id) do update set
		group_id      = coalesce(excluded.group_id, cc.group_id),
		price_list_id = coalesce(excluded.price_list_id, cc.price_list_id),
		invite_id     = excluded.invite_id,
		updated_at    = now()
	returning cc.id into v_cc_id;

	-- Auto-follow the company
	insert into public.company_follows (company_id, user_id)
	values (v_invite.company_id, v_actor)
	on conflict (company_id, user_id) do nothing;

	-- Increment uses_count
	update public.company_customer_invites set
		uses_count = uses_count + 1,
		updated_at = now()
	where id = v_invite.id;

	-- For personal (non-reusable) invites, mark as accepted
	if not v_invite.is_reusable then
		update public.company_customer_invites set
			status              = 'accepted',
			accepted_by         = v_actor,
			accepted_at         = now(),
			company_customer_id = v_cc_id,
			updated_at          = now()
		where id = v_invite.id;
	end if;

	-- Auto-create an active conversation so both sides can chat immediately.
	-- The create_conversation_participants trigger handles participant records.
	insert into public.conversations (company_id, customer_user_id, customer_name, status)
	values (v_invite.company_id, v_actor, v_insert_name, 'active')
	on conflict (company_id, customer_user_id) do nothing;

	-- Get company slug for redirect
	select c.slug into v_slug
	from public.companies c
	where c.id = v_invite.company_id;

	return jsonb_build_object(
		'id', v_cc_id,
		'company_slug', v_slug
	);
end;
$$;

comment on function public.accept_company_customer_invite(text) is
	'Accepts a customer invite, creating/updating the company_customer record with pre-assigned group and price list. '
	'Handles both personal (single-use) and shared (reusable) invites. '
	'Auto-creates an active conversation between the company and the customer.';
