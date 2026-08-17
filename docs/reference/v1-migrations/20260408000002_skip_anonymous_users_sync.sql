-- ============================================================================
-- Migration: skip_anonymous_users_sync
-- Description: Stop syncing anonymous (guest) users into public.users.
--              Anonymous rows serve no purpose — RLS blocks all their
--              operations on public.users and every FK-dependent table
--              (product_comments, product_likes, company_follows, etc.)
--              already gates inserts on not is_anonymous_user().
--              The UPDATE branch uses UPSERT to handle anon-to-real
--              conversion (Supabase updates the same auth.users row).
-- Dependencies: 20260301000004_users (sync_users_with_auth)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: Redefine sync function to skip anonymous users
-- ----------------------------------------------------------------------------

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
			if new.is_anonymous is true then
				return null;
			end if;

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
			if new.is_anonymous is true then
				return null;
			end if;

			if new.email is distinct from old.email
				or new.phone is distinct from old.phone
				or coalesce(new.raw_user_meta_data ->> 'first_name', '') is distinct from coalesce(old.raw_user_meta_data ->> 'first_name', '')
				or coalesce(new.raw_user_meta_data ->> 'last_name', '') is distinct from coalesce(old.raw_user_meta_data ->> 'last_name', '')
				or (old.is_anonymous is true and new.is_anonymous is not true)
			then
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
				where public.users.email is distinct from excluded.email
				   or public.users.phone is distinct from excluded.phone
				   or public.users.name is distinct from excluded.name
				   or public.users.last_name is distinct from excluded.last_name;
			end if;

		when 'DELETE' then
			delete from public.users where id = old.id;
	end case;

	return null;
end;
$$;

comment on function public.sync_users_with_auth() is
	'Syncs public.users with auth.users on changes. '
	'Skips anonymous users — they get a row only when converting to a real account.';

-- ----------------------------------------------------------------------------
-- PART 2: Clean up existing anonymous rows from public.users
-- ----------------------------------------------------------------------------
-- Safety: only delete rows that have no FK dependents in any referencing table.

delete from public.users
where id in (
	select au.id
	from auth.users au
	where au.is_anonymous = true
)
and not exists (select 1 from public.company_members    cm where cm.user_id = users.id)
and not exists (select 1 from public.company_customers  cc where cc.user_id = users.id)
and not exists (select 1 from public.product_comments   pc where pc.user_id = users.id)
and not exists (select 1 from public.product_likes      pl where pl.user_id = users.id)
and not exists (select 1 from public.company_follows    cf where cf.user_id = users.id)
and not exists (select 1 from public.customer_legal_info cl where cl.user_id = users.id)
and not exists (select 1 from public.counterparties     cp where cp.user_id = users.id)
and not exists (select 1 from public.documents          d  where d.signed_by = users.id or d.created_by = users.id)
and not exists (select 1 from public.document_signatures ds where ds.signed_by = users.id);
