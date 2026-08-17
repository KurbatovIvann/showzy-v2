-- ============================================================================
-- Migration: social
-- Description: Social interaction system — product likes and company follows
--              with toggle RPCs reading denormalized counters, and AFTER
--              triggers that maintain companies.followers_count and
--              products.likes_count.
-- Dependencies: companies, users, products, company_members (is_anonymous_user)
-- Sources: 034_product_likes, 035_company_follows,
--          086_denormalize_counts (followers + likes triggers only),
--          092_fix_toggle_denormalized_counts (final toggle functions)
-- ============================================================================

-- ############################################################################
-- PART 1: PRODUCT LIKES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: product_likes
-- ----------------------------------------------------------------------------

create table if not exists product_likes (
	id          uuid        default gen_random_uuid() primary key,
	product_id  uuid        not null references products (id) on delete cascade,
	company_id  uuid        not null references companies (id) on delete cascade,
	user_id     uuid        not null references users (id) on delete cascade,
	created_at  timestamptz default now(),

	constraint product_likes_unique unique (product_id, user_id)
);

comment on table  product_likes            is 'User likes on products (Instagram-style)';
comment on column product_likes.product_id is 'The product being liked';
comment on column product_likes.company_id is 'The company that owns the product';
comment on column product_likes.user_id    is 'The user who liked the product';

-- ----------------------------------------------------------------------------
-- Indexes (product_likes)
-- Removed idx_product_likes_product_id — covered by unique (product_id, user_id).
-- ----------------------------------------------------------------------------

create index idx_product_likes_user_id on product_likes (user_id);
create index idx_product_likes_company_id on product_likes (company_id);
create index idx_product_likes_created_at on product_likes (product_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS (product_likes) — from 034, unchanged by 062
-- ----------------------------------------------------------------------------

alter table product_likes enable row level security;
alter table product_likes force row level security;

create policy "product_likes: public read"
	on product_likes
	for select
	using (true);

create policy "product_likes: authenticated insert"
	on product_likes
	for insert
	to authenticated
	with check (
		user_id = (select auth.uid())
		and not is_anonymous_user()
	);

create policy "product_likes: owner delete"
	on product_likes
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

-- ############################################################################
-- PART 2: COMPANY FOLLOWS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: company_follows
-- ----------------------------------------------------------------------------

create table if not exists company_follows (
	id          uuid        default gen_random_uuid() primary key,
	company_id  uuid        not null references companies (id) on delete cascade,
	user_id     uuid        not null references users (id) on delete cascade,
	created_at  timestamptz default now(),

	constraint company_follows_unique unique (company_id, user_id)
);

comment on table  company_follows            is 'User follows on companies (Instagram-style)';
comment on column company_follows.company_id is 'The company being followed';
comment on column company_follows.user_id    is 'The user who followed the company';

-- ----------------------------------------------------------------------------
-- Indexes (company_follows)
-- Removed idx_company_follows_company_id — covered by unique (company_id, user_id).
-- ----------------------------------------------------------------------------

create index idx_company_follows_user_id on company_follows (user_id);
create index idx_company_follows_created_at on company_follows (company_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS (company_follows) — from 035, unchanged by 062
-- ----------------------------------------------------------------------------

alter table company_follows enable row level security;
alter table company_follows force row level security;

create policy "company_follows: public read"
	on company_follows
	for select
	using (true);

create policy "company_follows: authenticated insert"
	on company_follows
	for insert
	to authenticated
	with check (
		user_id = (select auth.uid())
		and not is_anonymous_user()
	);

create policy "company_follows: owner delete"
	on company_follows
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

-- ############################################################################
-- PART 3: TOGGLE FUNCTIONS (final versions from 092)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: toggle_product_like
-- Reads products.likes_count (maintained by trg_update_likes_count trigger)
-- instead of COUNT(*) for O(1) count retrieval.
-- SECURITY DEFINER: bypasses RLS for the toggle + count read.
-- ----------------------------------------------------------------------------

create or replace function toggle_product_like(
	p_product_id uuid,
	p_company_id uuid
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_is_anonymous boolean;
	v_existing_like uuid;
	v_liked boolean;
	v_count bigint;
begin
	if v_user_id is null then
		raise exception 'User must be authenticated to like products';
	end if;

	select public.is_anonymous_user() into v_is_anonymous;
	if v_is_anonymous then
		raise exception 'Anonymous users cannot like products';
	end if;

	select id into v_existing_like
	from public.product_likes
	where product_id = p_product_id and user_id = v_user_id;

	if v_existing_like is not null then
		delete from public.product_likes where id = v_existing_like;
		v_liked := false;
	else
		insert into public.product_likes (product_id, company_id, user_id)
		values (p_product_id, p_company_id, v_user_id);
		v_liked := true;
	end if;

	select likes_count into v_count from public.products where id = p_product_id;

	return json_build_object(
		'liked', v_liked,
		'likesCount', v_count
	);
end;
$$;

comment on function toggle_product_like is 'Toggle like on a product, returns new state and denormalized count';

grant execute on function toggle_product_like to authenticated;

-- ----------------------------------------------------------------------------
-- Function: toggle_company_follow
-- Reads companies.followers_count (maintained by trg_update_followers_count
-- trigger) instead of COUNT(*) for O(1) count retrieval.
-- SECURITY DEFINER: bypasses RLS for the toggle + count read.
-- ----------------------------------------------------------------------------

create or replace function toggle_company_follow(p_company_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_is_anonymous boolean;
	v_existing_follow uuid;
	v_followed boolean;
	v_count bigint;
begin
	if v_user_id is null then
		raise exception 'User must be authenticated to follow companies';
	end if;

	select public.is_anonymous_user() into v_is_anonymous;
	if v_is_anonymous then
		raise exception 'Anonymous users cannot follow companies';
	end if;

	select id into v_existing_follow
	from public.company_follows
	where company_id = p_company_id and user_id = v_user_id;

	if v_existing_follow is not null then
		delete from public.company_follows where id = v_existing_follow;
		v_followed := false;
	else
		insert into public.company_follows (company_id, user_id)
		values (p_company_id, v_user_id);
		v_followed := true;
	end if;

	select followers_count into v_count from public.companies where id = p_company_id;

	return json_build_object(
		'followed', v_followed,
		'followersCount', v_count
	);
end;
$$;

comment on function toggle_company_follow is 'Toggle follow on a company, returns new state and denormalized count';

grant execute on function toggle_company_follow to authenticated;

-- ############################################################################
-- PART 4: COUNTER TRIGGER FUNCTIONS (from 086)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function + Trigger: trg_update_followers_count
-- Maintains companies.followers_count on company_follows INSERT/DELETE.
-- ----------------------------------------------------------------------------

create or replace function trg_update_followers_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		update public.companies set followers_count = followers_count + 1 where id = new.company_id;
	elsif tg_op = 'DELETE' then
		update public.companies set followers_count = greatest(0, followers_count - 1) where id = old.company_id;
	end if;

	return coalesce(new, old);
end;
$$;

comment on function trg_update_followers_count() is
	'Maintains companies.followers_count — increments on follow, decrements on unfollow';

create trigger trg_followers_count
	after insert or delete on company_follows
	for each row
	execute function trg_update_followers_count();

-- ----------------------------------------------------------------------------
-- Function + Trigger: trg_update_likes_count
-- Maintains products.likes_count on product_likes INSERT/DELETE.
-- ----------------------------------------------------------------------------

create or replace function trg_update_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		update public.products set likes_count = likes_count + 1 where id = new.product_id;
	elsif tg_op = 'DELETE' then
		update public.products set likes_count = greatest(0, likes_count - 1) where id = old.product_id;
	end if;

	return coalesce(new, old);
end;
$$;

comment on function trg_update_likes_count() is
	'Maintains products.likes_count — increments on like, decrements on unlike';

create trigger trg_likes_count
	after insert or delete on product_likes
	for each row
	execute function trg_update_likes_count();

-- ############################################################################
-- REALTIME CONFIGURATION (from 047)
-- ############################################################################

alter publication supabase_realtime add table company_follows;
