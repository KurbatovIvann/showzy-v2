-- ============================================================================
-- Migration: company_members + permissions_core
-- Description: Company members table for role-based access (owner, admin,
--              manager, employee). Defines helper functions used in RLS
--              policies across the entire schema: is_company_owner(),
--              is_company_member(), has_company_permission().
--              Includes core permission infrastructure: role_permission_defaults
--              table and has_company_permission() function, so all subsequent
--              migrations can use granular permission checks.
-- Dependencies: companies, users, core_functions (update_timestamp,
--              is_anonymous_user)
-- Sources: 023_company_members, 062_permissions_enforcement
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table Definition
-- ----------------------------------------------------------------------------

create table if not exists company_members (
	id          uuid        default gen_random_uuid() primary key,
	company_id  uuid        not null references companies (id) on delete cascade,
	user_id     uuid        not null references users (id) on delete cascade,
	role        text        not null default 'owner'
	                        constraint chk_company_members_role
	                        check (role in ('owner', 'admin', 'manager', 'employee')),
	permissions jsonb       default '{}',
	created_at  timestamptz default now(),
	updated_at  timestamptz default now(),

	unique (company_id, user_id)
);

comment on table  company_members             is 'Company members with role-based access (owners, employees, etc.)';
comment on column company_members.role        is 'Member role: owner, admin, manager, employee';
comment on column company_members.permissions is 'Granular permission overrides (granted/denied arrays)';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index if not exists company_members_company_idx on company_members (company_id);
create index if not exists company_members_user_idx on company_members (user_id);
create index if not exists company_members_role_idx on company_members (role);

-- ----------------------------------------------------------------------------
-- Helper Functions (defined before RLS to avoid forward-reference issues)
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER: bypasses RLS when checking ownership to prevent recursion
create or replace function is_company_owner(p_company_id uuid, p_user_id uuid default auth.uid())
	returns boolean
	language sql
	security definer
	stable
	set search_path = ''
as $$
	select exists (
		select 1 from public.company_members
		where company_id = p_company_id
		  and user_id = p_user_id
		  and role = 'owner'
	);
$$;

comment on function is_company_owner(uuid, uuid) is 'Check if user is owner of a company (bypasses RLS)';

-- SECURITY DEFINER: bypasses RLS when checking membership to prevent recursion
create or replace function is_company_member(p_company_id uuid, p_user_id uuid default auth.uid())
	returns boolean
	language sql
	security definer
	stable
	set search_path = ''
as $$
	select exists (
		select 1 from public.company_members
		where company_id = p_company_id
		  and user_id = p_user_id
	);
$$;

comment on function is_company_member(uuid, uuid) is 'Check if user is a member of a company (any role, bypasses RLS)';

-- SECURITY DEFINER: bypasses RLS to prevent recursion when checking from
-- inside the INSERT policy on the same table.
create or replace function has_no_company_members(p_company_id uuid)
	returns boolean
	language sql
	security definer
	stable
	set search_path = ''
as $$
	select not exists (
		select 1 from public.company_members
		where company_id = p_company_id
	);
$$;

comment on function has_no_company_members(uuid) is 'Check if a company has no members yet (bypasses RLS, used in INSERT policy)';

-- ############################################################################
-- PERMISSIONS CORE (was 005500_permissions_core.sql, merged here to guarantee
-- correct migration ordering — company_members must exist before
-- has_company_permission() is created, and has_company_permission() must exist
-- before RLS policies that reference it)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: role_permission_defaults
-- ----------------------------------------------------------------------------

create table if not exists role_permission_defaults (
	role       text not null,
	permission text not null,
	primary key (role, permission)
);

comment on table role_permission_defaults is 'Default permissions per role for DB-level permission checks';
comment on column role_permission_defaults.role is 'Role name: admin, manager, employee (owner has all permissions implicitly)';
comment on column role_permission_defaults.permission is 'Permission key in resource:action format';

alter table role_permission_defaults enable row level security;
alter table role_permission_defaults force row level security;

-- ----------------------------------------------------------------------------
-- Function: has_company_permission
-- Resolves role defaults + per-member overrides (granted/denied arrays).
-- Owners implicitly have all permissions.
-- ----------------------------------------------------------------------------

create or replace function has_company_permission(
	p_company_id uuid,
	p_permission text,
	p_user_id uuid default auth.uid()
) returns boolean
security definer
stable
language plpgsql
set search_path = ''
as $$
declare
	v_role text;
	v_permissions jsonb;
begin
	select role, permissions into v_role, v_permissions
	from public.company_members
	where company_id = p_company_id
	  and user_id = p_user_id;

	if v_role is null then
		return false;
	end if;

	if v_role = 'owner' then
		return true;
	end if;

	if v_permissions is not null
	   and v_permissions ? 'denied'
	   and exists (
	       select 1
	       from jsonb_array_elements_text(v_permissions->'denied') as d
	       where d = p_permission
	   )
	then
		return false;
	end if;

	if v_permissions is not null
	   and v_permissions ? 'granted'
	   and exists (
	       select 1
	       from jsonb_array_elements_text(v_permissions->'granted') as g
	       where g = p_permission
	   )
	then
		return true;
	end if;

	return exists (
		select 1 from public.role_permission_defaults
		where role = v_role
		  and permission = p_permission
	);
end;
$$;

comment on function has_company_permission(uuid, text, uuid) is
	'Check if a user has a specific permission in a company (resolves role defaults + overrides)';

grant execute on function has_company_permission(uuid, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Seed: role_permission_defaults
-- ----------------------------------------------------------------------------

insert into role_permission_defaults (role, permission) values
	('admin', 'products:view'),
	('admin', 'products:create'),
	('admin', 'products:edit'),
	('admin', 'products:delete'),
	('admin', 'categories:view'),
	('admin', 'categories:manage'),
	('admin', 'orders:view'),
	('admin', 'orders:create'),
	('admin', 'orders:edit'),
	('admin', 'orders:delete'),
	('admin', 'orders:change_status'),
	('admin', 'customers:view'),
	('admin', 'customers:create'),
	('admin', 'customers:edit'),
	('admin', 'customers:delete'),
	('admin', 'price_lists:view'),
	('admin', 'price_lists:manage'),
	('admin', 'team:view'),
	('admin', 'team:invite'),
	('admin', 'team:manage'),
	('admin', 'settings:view'),
	('admin', 'settings:general'),
	('admin', 'settings:payments'),
	('admin', 'settings:statuses'),
	('admin', 'settings:delivery'),
	('admin', 'settings:units'),
	('admin', 'showcase:view'),
	('admin', 'showcase:edit'),
	('admin', 'chat:view'),
	('admin', 'chat:respond'),
	('admin', 'chat:assign'),
	('admin', 'chat:delete'),
	('admin', 'analytics:view'),
	('admin', 'analytics:export'),
	('admin', 'ai:use'),
	('admin', 'ai:configure'),
	('admin', 'integrations:view'),
	('admin', 'integrations:manage'),
	('admin', 'transactions:view'),
	('admin', 'transactions:link'),
	('admin', 'notifications:view')
on conflict do nothing;

insert into role_permission_defaults (role, permission) values
	('manager', 'products:view'),
	('manager', 'products:create'),
	('manager', 'products:edit'),
	('manager', 'categories:view'),
	('manager', 'orders:view'),
	('manager', 'orders:create'),
	('manager', 'orders:edit'),
	('manager', 'orders:change_status'),
	('manager', 'customers:view'),
	('manager', 'customers:create'),
	('manager', 'customers:edit'),
	('manager', 'price_lists:view'),
	('manager', 'team:view'),
	('manager', 'settings:view'),
	('manager', 'showcase:view'),
	('manager', 'chat:view'),
	('manager', 'chat:respond'),
	('manager', 'chat:assign'),
	('manager', 'analytics:view'),
	('manager', 'ai:use'),
	('manager', 'transactions:view'),
	('manager', 'notifications:view')
on conflict do nothing;

insert into role_permission_defaults (role, permission) values
	('employee', 'products:view'),
	('employee', 'categories:view'),
	('employee', 'orders:view'),
	('employee', 'orders:create'),
	('employee', 'orders:change_status'),
	('employee', 'customers:view'),
	('employee', 'price_lists:view'),
	('employee', 'showcase:view'),
	('employee', 'chat:view'),
	('employee', 'chat:respond'),
	('employee', 'ai:use'),
	('employee', 'notifications:view')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) — company_members
-- ----------------------------------------------------------------------------

alter table company_members enable row level security;
alter table company_members force row level security;

create policy "company_members: select"
	on company_members
	for select
	to authenticated
	using (
		user_id = (select auth.uid())
		or
		has_company_permission(company_id, 'team:view', (select auth.uid()))
	);

create policy "company_members: insert"
	on company_members
	for insert
	to authenticated
	with check (
		(
			user_id = (select auth.uid())
			and role = 'owner'
			and (select has_no_company_members(company_id))
		)
		or
		(select has_company_permission(company_id, 'team:invite', (select auth.uid())))
	);

create policy "company_members: update"
	on company_members
	for update
	to authenticated
	using (
		has_company_permission(company_id, 'team:manage', (select auth.uid()))
		and user_id != (select auth.uid())
		and role != 'owner'
	)
	with check (
		has_company_permission(company_id, 'team:manage', (select auth.uid()))
	);

create policy "company_members: delete"
	on company_members
	for delete
	to authenticated
	using (
		has_company_permission(company_id, 'team:manage', (select auth.uid()))
		and user_id != (select auth.uid())
		and role != 'owner'
	);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) — companies
-- Update uses settings:general permission; delete stays owner-only (destructive).
-- ----------------------------------------------------------------------------

create policy "companies: settings update"
	on companies for update
	using (has_company_permission(id, 'settings:general', (select auth.uid())));

create policy "companies: owner delete"
	on companies for delete
	using (is_company_owner(id, (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

create trigger company_members_update_timestamp
	before update on company_members
	for each row
	execute function update_timestamp();
