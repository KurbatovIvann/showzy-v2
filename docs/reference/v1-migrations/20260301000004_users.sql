-- ============================================================================
-- Migration: users
-- Description: Public user profiles synced from auth.users via trigger.
--              Includes username (mobile onboarding), protection trigger for
--              email/phone columns, and secure username-availability RPC.
-- Dependencies: core_functions (update_timestamp)
-- Sources: 004_users, 075_add_username_to_users,
--          094_tighten_users_rls, 098_fix_create_order_customer_upsert
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table Definition
-- ----------------------------------------------------------------------------

create table if not exists users (
	id           uuid primary key references auth.users (id) on delete cascade,
	name         text,
	last_name    text,
	email        text,
	phone        text,
	username     text,
	display_name text,
	avatar       text,
	created_at   timestamptz default now(),
	updated_at   timestamptz default now()
);

comment on table  users              is 'Public user profiles synced from auth.users';
comment on column users.username     is 'Unique handle chosen during mobile onboarding';
comment on column users.display_name is 'User-chosen display name (not synced from auth)';
comment on column users.avatar       is 'URL to user avatar image';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create unique index idx_users_username on users (lower(username))
	where username is not null;

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------

alter table users enable row level security;
alter table users force row level security;

create policy "users: select own"
	on users
	for select
	using ((select auth.uid()) = id);

create policy "users: insert own"
	on users
	for insert
	with check ((select auth.uid()) = id);

create policy "users: update own"
	on users
	for update
	to authenticated
	using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

create policy "users: delete own"
	on users
	for delete
	using ((select auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- Trigger Functions
-- ----------------------------------------------------------------------------

-- Protects email/phone from direct modification. Only the sync_users_with_auth
-- trigger (which sets the app.is_auth_sync session flag) can change these columns.
create or replace function protect_users_synced_columns()
	returns trigger
	language plpgsql
	set search_path = ''
as $$
begin
	if current_setting('app.is_auth_sync', true) = 'true' then
		return new;
	end if;
	new.email := old.email;
	new.phone := old.phone;
	return new;
end;
$$;

comment on function protect_users_synced_columns() is
	'Prevents direct modification of email/phone on public.users. '
	'Only the sync_users_with_auth trigger (which sets app.is_auth_sync) can change these columns.';

-- Syncs public.users with auth.users on insert/update/delete.
-- Sets session flag so protect_users_synced_columns allows the write.
create or replace function public.sync_users_with_auth()
	returns trigger
	language plpgsql
	security definer
	set search_path = ''
as $$
begin
	perform set_config('app.is_auth_sync', 'true', true);

	case TG_OP
		when 'INSERT' then
			insert into public.users (id, email, phone, name, last_name)
			values (
				new.id,
				new.email,
				new.phone,
				new.raw_user_meta_data ->> 'first_name',
				new.raw_user_meta_data ->> 'last_name'
			)
			on conflict (id) do update
				set email     = excluded.email,
				    phone     = excluded.phone,
				    name      = excluded.name,
				    last_name = excluded.last_name
			where public.users.email is distinct from excluded.email
			   or public.users.phone is distinct from excluded.phone
			   or public.users.name is distinct from excluded.name
			   or public.users.last_name is distinct from excluded.last_name;

		when 'UPDATE' then
			if new.email is distinct from old.email
				or new.phone is distinct from old.phone
				or coalesce(new.raw_user_meta_data ->> 'first_name', '') is distinct from coalesce(old.raw_user_meta_data ->> 'first_name', '')
				or coalesce(new.raw_user_meta_data ->> 'last_name', '') is distinct from coalesce(old.raw_user_meta_data ->> 'last_name', '')
			then
				update public.users
				set email     = new.email,
				    phone     = new.phone,
				    name      = case
				                    when new.raw_user_meta_data is not null and new.raw_user_meta_data ? 'first_name'
				                        then new.raw_user_meta_data ->> 'first_name'
				                    else public.users.name
				                end,
				    last_name = case
				                    when new.raw_user_meta_data is not null and new.raw_user_meta_data ? 'last_name'
				                        then new.raw_user_meta_data ->> 'last_name'
				                    else public.users.last_name
				                end
				where id = new.id;
			end if;

		when 'DELETE' then
			delete from public.users where id = old.id;
	end case;

	return null;
end;
$$;

comment on function public.sync_users_with_auth() is 'Syncs public.users with auth.users on changes';

-- ----------------------------------------------------------------------------
-- Username Availability RPC
-- ----------------------------------------------------------------------------

create or replace function check_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select not exists(
		select 1 from public.users where public.users.username = lower(trim(p_username))
	);
$$;

comment on function check_username_available is
	'Check if a username is available. Safe for unauthenticated calls — returns only a boolean.';

grant execute on function check_username_available to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

create trigger on_auth_user_created
	after insert or update or delete on auth.users
	for each row
	execute procedure public.sync_users_with_auth();

create trigger protect_users_synced_columns_trigger
	before update on users
	for each row
	execute function protect_users_synced_columns();

create trigger set_users_updated_at
	before update on users
	for each row
	execute function update_timestamp();
