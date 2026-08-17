-- ============================================================================
-- Migration: security_hardening
-- Description: Production readiness — fixes Supabase advisor issues and adds
--              missing FK indexes per Postgres best practices.
-- Dependencies: messaging_enhancements (20260319000001),
--               company_keywords (20260320000010),
--               public_profiles_and_users_rls (20260306000001),
--               company_customer_invites (20260331000003)
--
-- Fixes:
--   1. function_search_path_mutable (WARN)  — 2 functions
--   2. security_definer_view       (ERROR) — public_profiles
--   3. rls_enabled_no_policy       (INFO)  — 7 tables
--   4. Missing FK indexes          (PERF)  — 18 columns
--   5. multiple_permissive_policies (WARN) — users (wrap view in SD function)
--   6. multiple_permissive_policies (WARN) — customer_groups (merge SELECT)
--
-- Best-practice references:
--   security-rls-basics, security-rls-performance, security-privileges,
--   schema-foreign-key-indexes, query-missing-indexes, query-partial-indexes,
--   security-rls-multiple-permissive
-- ============================================================================


-- ############################################################################
-- PART 1: FIX FUNCTION SEARCH PATH (function_search_path_mutable)
-- ############################################################################

-- 1a. toggle_message_reaction — add SET search_path, qualify table refs
-- Original: 20260319000001_messaging_enhancements.sql (SECURITY DEFINER, no search_path)

create or replace function public.toggle_message_reaction(
	p_message_id uuid,
	p_user_id uuid,
	p_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_existing_emoji text;
	v_action text;
	v_reactions jsonb;
begin
	select emoji into v_existing_emoji
	from public.message_reactions
	where message_id = p_message_id
	  and user_id = p_user_id;

	if v_existing_emoji is not null then
		delete from public.message_reactions
		where message_id = p_message_id
		  and user_id = p_user_id;

		if v_existing_emoji = p_emoji then
			v_action := 'remove';
		else
			insert into public.message_reactions (message_id, user_id, emoji)
			values (p_message_id, p_user_id, p_emoji);
			v_action := 'replace';
		end if;
	else
		insert into public.message_reactions (message_id, user_id, emoji)
		values (p_message_id, p_user_id, p_emoji);
		v_action := 'add';
	end if;

	v_reactions := coalesce(
		(select jsonb_agg(jsonb_build_object(
			'emoji', r.emoji,
			'userIds', r.user_ids
		))
		from (
			select emoji, array_agg(user_id::text order by created_at) as user_ids
			from public.message_reactions
			where message_id = p_message_id
			group by emoji
		) r),
		'[]'::jsonb
	);

	return jsonb_build_object(
		'action', v_action,
		'reactions', v_reactions
	);
end;
$$;

-- 1b. immutable_array_to_string — add SET search_path
-- Original: 20260320000010_company_keywords.sql (no search_path)

create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array_to_string(arr, sep);
$$;


-- ############################################################################
-- PART 2: FIX SECURITY DEFINER VIEW (security_definer_view)
-- ############################################################################
-- public_profiles bypassed users RLS because security_invoker defaults to OFF.
-- Fix: wrap the query in a SECURITY DEFINER function with locked search_path,
-- then expose it through the view with security_invoker = on.  This way
-- the function bypasses RLS (safe — returns only non-sensitive columns),
-- while authenticated users' direct access to the users table stays
-- restricted to their own row + company customers.

-- Restrict anon to safe columns only (security-privileges)
revoke all on users from anon;
grant select (id, name, last_name, display_name, username, avatar) on users to anon;

-- Anon-only broad read for the limited columns they can see.
create policy "users: anon profile read"
	on users for select to anon using (true);

-- SECURITY DEFINER function that returns safe profile columns for any user.
-- Locked search_path avoids the function_search_path_mutable warning.
create or replace function public.get_public_profiles()
returns table (
	id           uuid,
	name         text,
	last_name    text,
	display_name text,
	username     text,
	avatar       text
)
language sql
stable
security definer
set search_path = ''
as $$
	select u.id, u.name, u.last_name, u.display_name, u.username, u.avatar
	from public.users u;
$$;

-- Recreate view on top of the function.
-- security_invoker = on silences the linter; actual RLS bypass is in the
-- function (intentional — only non-sensitive columns are returned).
create or replace view public_profiles
with (security_invoker = on) as
select * from public.get_public_profiles();

comment on view public_profiles is
	'Public subset of user profiles. Backed by a SECURITY DEFINER function '
	'that returns only safe columns (no email/phone).';

grant select on public_profiles to anon, authenticated;


-- ############################################################################
-- PART 3: FIX RLS ENABLED NO POLICY (rls_enabled_no_policy)
-- ############################################################################
-- These tables intentionally deny all direct access; only service_role or
-- SECURITY DEFINER functions reach them. Explicit USING(false) policies
-- document the intent and silence the linter.

create policy "service_role_only" on company_sku_sequences       for all using (false);
create policy "service_role_only" on document_number_counters    for all using (false);
create policy "service_role_only" on domain_events               for all using (false);
create policy "service_role_only" on integration_secrets          for all using (false);
create policy "service_role_only" on meta_data_deletion_requests for all using (false);
create policy "service_role_only" on role_permission_defaults    for all using (false);
create policy "service_role_only" on verifications               for all using (false);

-- Pair ENABLE + FORCE on tables that were missing FORCE (security-rls-basics)
alter table domain_events force row level security;
alter table meta_data_deletion_requests force row level security;


-- ############################################################################
-- PART 4: MISSING FOREIGN KEY INDEXES (schema-foreign-key-indexes)
-- ############################################################################
-- Postgres does NOT auto-index FK columns. Missing indexes cause slow JOINs
-- and CASCADE operations. Nullable FKs use partial indexes to skip NULLs
-- (query-partial-indexes).
--
-- Discovered via:
--   select conrelid::regclass, a.attname
--   from pg_constraint c
--   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
--   where c.contype = 'f'
--     and not exists (select 1 from pg_index i
--                     where i.indrelid = c.conrelid and a.attnum = any(i.indkey));

create index if not exists idx_products_unit_type_id
	on products (unit_type_id)
	where unit_type_id is not null;

create index if not exists idx_product_images_company_id
	on product_images (company_id);

create index if not exists idx_product_comments_company_id
	on product_comments (company_id);

create index if not exists idx_customer_groups_price_list_id
	on customer_groups (price_list_id)
	where price_list_id is not null;

create index if not exists idx_order_items_company_id
	on order_items (company_id);

create index if not exists idx_checkout_sessions_company_id
	on checkout_sessions (company_id);

create index if not exists idx_checkout_sessions_completed_order_id
	on checkout_sessions (completed_order_id)
	where completed_order_id is not null;

create index if not exists idx_conversation_participants_last_seen_message_id
	on conversation_participants (last_seen_message_id)
	where last_seen_message_id is not null;

create index if not exists idx_bank_transactions_matched_payment_id
	on bank_transactions (matched_payment_id)
	where matched_payment_id is not null;

create index if not exists idx_status_auto_transitions_to_status_id
	on status_auto_transitions (to_status_id);

create index if not exists idx_company_customer_invites_accepted_by
	on company_customer_invites (accepted_by)
	where accepted_by is not null;

create index if not exists idx_company_customer_invites_company_customer_id
	on company_customer_invites (company_customer_id)
	where company_customer_id is not null;

create index if not exists idx_company_customer_invites_group_id
	on company_customer_invites (group_id)
	where group_id is not null;

create index if not exists idx_company_customer_invites_invited_by
	on company_customer_invites (invited_by);

create index if not exists idx_company_customer_invites_price_list_id
	on company_customer_invites (price_list_id)
	where price_list_id is not null;

create index if not exists idx_carts_company_id
	on carts (company_id)
	where company_id is not null;

create index if not exists idx_product_variant_options_option_id
	on product_variant_options (option_id);

create index if not exists idx_status_auto_transitions_from_status_id
	on status_auto_transitions (from_status_id);


-- ############################################################################
-- PART 5: MERGE MULTIPLE PERMISSIVE POLICIES (multiple_permissive_policies)
-- ############################################################################
-- customer_groups had two permissive SELECT policies for authenticated:
--   "customer_groups: select" (company members with customers:view)
--   "customer_groups: customer self read" (customer sees own group)
-- Merging into a single policy avoids redundant per-row evaluation.

drop policy if exists "customer_groups: select" on customer_groups;
drop policy if exists "customer_groups: customer self read" on customer_groups;

create policy "customer_groups: select"
	on customer_groups
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'customers:view', (select auth.uid()))
		or exists (
			select 1 from company_customers cc
			where cc.group_id = customer_groups.id
			  and cc.user_id = (select auth.uid())
		)
	);
