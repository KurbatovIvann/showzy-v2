-- ============================================================================
-- Migration: company_customer_invites
-- Description: Token-based invite system for companies to invite customers.
--              Supports personal (single-use) and shared (reusable) invite links
--              with pre-assigned customer groups and price lists.
-- Dependencies: companies (003), users (004), company_members (005),
--               company_customers + customer_groups + price_lists (008),
--               has_company_permission (005)
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;

-- ============================================================================
-- 1. Table: company_customer_invites
-- ============================================================================

create table public.company_customer_invites (
	id              uuid primary key default gen_random_uuid(),
	company_id      uuid not null references public.companies(id) on delete cascade,

	group_id        uuid references public.customer_groups(id) on delete set null,
	price_list_id   uuid references public.price_lists(id) on delete set null,

	email           text,
	phone           text,
	name            text,

	token           text not null unique default encode(gen_random_bytes(32), 'hex'),
	status          text not null default 'pending'
	                check (status in ('pending', 'accepted', 'expired', 'revoked')),

	is_reusable     boolean not null default true,
	max_uses        integer,
	uses_count      integer not null default 0,

	company_customer_id uuid references public.company_customers(id) on delete set null,
	accepted_by     uuid references public.users(id) on delete set null,
	accepted_at     timestamptz,

	invited_by      uuid not null references public.users(id),
	expires_at      timestamptz not null default now() + interval '1 day',
	created_at      timestamptz not null default now(),
	updated_at      timestamptz not null default now()
);

comment on table public.company_customer_invites is
	'Token-based invite links for companies to invite customers with pre-assigned groups and price lists.';

alter table public.company_customer_invites enable row level security;
alter table public.company_customer_invites force row level security;

-- updated_at trigger
create trigger set_company_customer_invites_updated_at
	before update on public.company_customer_invites
	for each row
	execute function update_timestamp();

-- ============================================================================
-- 2. Indexes
-- ============================================================================

create index idx_invites_company_status
	on public.company_customer_invites (company_id, status);

create index idx_invites_company_email
	on public.company_customer_invites (company_id, email)
	where status = 'pending' and email is not null;

create index idx_invites_expires_at
	on public.company_customer_invites (expires_at)
	where status = 'pending';

-- ============================================================================
-- 3. Alter company_customers: add invite_id for traceability
-- ============================================================================

alter table public.company_customers
	add column invite_id uuid references public.company_customer_invites(id) on delete set null;

create index idx_company_customers_invite_id
	on public.company_customers (invite_id)
	where invite_id is not null;

-- ============================================================================
-- 4. RLS Policies
-- ============================================================================

create policy "company_customer_invites: member select"
	on public.company_customer_invites
	for select
	to authenticated
	using (
		public.has_company_permission(company_id, 'customers:view', (select auth.uid()))
	);

create policy "company_customer_invites: member insert"
	on public.company_customer_invites
	for insert
	to authenticated
	with check (
		public.has_company_permission(company_id, 'customers:invite', (select auth.uid()))
	);

create policy "company_customer_invites: member update"
	on public.company_customer_invites
	for update
	to authenticated
	using (
		public.has_company_permission(company_id, 'customers:invite', (select auth.uid()))
	)
	with check (
		public.has_company_permission(company_id, 'customers:invite', (select auth.uid()))
	);

-- ============================================================================
-- 5. Permission defaults
-- ============================================================================

insert into public.role_permission_defaults (role, permission) values
	('admin', 'customers:invite'),
	('manager', 'customers:invite');

-- ============================================================================
-- 6. RPC: get_invite_details (public-facing, no auth required)
-- ============================================================================

create or replace function public.get_invite_details(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
	v_invite       record;
	v_company      record;
	v_group_name   text;
	v_is_expired   boolean;
begin
	select
		i.id, i.company_id, i.group_id, i.price_list_id,
		i.status, i.is_reusable, i.name as invite_name,
		i.expires_at
	into v_invite
	from public.company_customer_invites i
	where i.token = p_token;

	if not found then
		return jsonb_build_object(
			'valid', false,
			'error', 'not_found'
		);
	end if;

	select c.name, c.slug, c.logo_url
	into v_company
	from public.companies c
	where c.id = v_invite.company_id;

	if v_invite.group_id is not null then
		select cg.name into v_group_name
		from public.customer_groups cg
		where cg.id = v_invite.group_id;
	end if;

	v_is_expired := v_invite.expires_at <= now();

	return jsonb_build_object(
		'valid', true,
		'status', v_invite.status,
		'is_expired', v_is_expired,
		'is_reusable', v_invite.is_reusable,
		'company_name', v_company.name,
		'company_slug', v_company.slug,
		'company_logo_url', v_company.logo_url,
		'group_name', v_group_name,
		'can_accept', v_invite.status = 'pending' and not v_is_expired
	);
end;
$$;

comment on function public.get_invite_details(text) is
	'Returns public invite details for display on the accept page. No auth required.';

grant execute on function public.get_invite_details(text) to anon, authenticated;

-- ============================================================================
-- 7. RPC: accept_company_customer_invite (requires auth)
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
	'Handles both personal (single-use) and shared (reusable) invites.';

grant execute on function public.accept_company_customer_invite(text) to authenticated;
revoke execute on function public.accept_company_customer_invite(text) from anon, public;

-- ============================================================================
-- 8. Expiry cron job (hourly housekeeping)
-- ============================================================================

select cron.schedule(
	'expire-pending-invites',
	'0 * * * *',
	$$update public.company_customer_invites
	  set status = 'expired', updated_at = now()
	  where status = 'pending' and expires_at < now()$$
);
