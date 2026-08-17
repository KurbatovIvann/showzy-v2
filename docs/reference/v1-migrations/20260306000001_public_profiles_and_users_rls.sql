-- ============================================================================
-- Migration: public_profiles_and_users_rls
-- Description: Adds a public_profiles view for safe cross-user reads, a
--              security-definer helper for company-member-to-customer lookups,
--              a scoped SELECT policy on users for company members, and
--              updates product_comments_view to join public_profiles.
-- Dependencies: users (004), company_members (005), products (007),
--              customers_and_pricing (008)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Index: company_customers.user_id
-- The existing unique constraint is (company_id, user_id) which does not
-- support efficient lookups by user_id alone. The new RLS helper function
-- needs this for the join predicate.
-- ----------------------------------------------------------------------------

create index if not exists idx_company_customers_user_id
	on company_customers (user_id)
	where user_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Helper function: is_customer_of_company_member
-- Security definer to bypass RLS on company_customers and company_members
-- (both have their own RLS). Follows the existing is_company_member pattern.
-- ----------------------------------------------------------------------------

create or replace function is_customer_of_company_member(p_user_id uuid)
	returns boolean
	language sql
	security definer
	stable
	set search_path = ''
as $$
	select exists (
		select 1
		from public.company_customers cc
		join public.company_members cm on cm.company_id = cc.company_id
		where cc.user_id = p_user_id
		  and cm.user_id = (select auth.uid())
	);
$$;

comment on function is_customer_of_company_member(uuid) is
	'Check if the current user is a company member whose company has the given user as a customer (bypasses RLS)';

-- ----------------------------------------------------------------------------
-- 3. Policy: users — company member reads customer
-- Lets company members read full rows (email, phone) of their linked
-- customers. Combined with the existing "users: select own" policy via
-- Postgres OR-combination of SELECT policies.
-- ----------------------------------------------------------------------------

create policy "users: company member reads customer"
	on users
	for select
	to authenticated
	using (is_customer_of_company_member(id));

-- ----------------------------------------------------------------------------
-- 4. View: public_profiles
-- Exposes only non-sensitive user fields. security_invoker defaults to off,
-- so the view runs as its owner (postgres) and bypasses users RLS.
-- Safe because no email, phone, or future sensitive fields are exposed.
-- ----------------------------------------------------------------------------

create or replace view public_profiles as
select id, name, last_name, display_name, username, avatar
from users;

comment on view public_profiles is
	'Public subset of user profiles. Safe for cross-user reads (no email/phone).';

grant select on public_profiles to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. View: product_comments_view (updated)
-- Joins public_profiles instead of users so comment author info is visible
-- to all callers. Removes email from coalesce fallback.
-- ----------------------------------------------------------------------------

create or replace view product_comments_view
with (security_invoker = on)
as
select
	pc.id,
	pc.product_id,
	pc.company_id,
	pc.user_id,
	pc.parent_id,
	pc.content,
	pc.is_company_reply,
	pc.created_at,
	pc.updated_at,
	coalesce(p.name || ' ' || p.last_name, 'Anonymous') as user_name,
	p.avatar as user_avatar
from product_comments pc
left join public_profiles p on pc.user_id = p.id;

comment on view product_comments_view is 'Product comments with user display information';
