-- ============================================================================
-- Migration: customers_and_pricing
-- Description: Customer management and pricing system — price lists with
--              single-default enforcement, customer groups for segmentation,
--              company customers with embeddings, per-list and per-customer
--              price overrides, and a pricing hierarchy resolver.
-- Dependencies: companies, users, products, core_functions (update_timestamp),
--              company_members (is_company_owner, is_company_member),
--              extensions (pgvector)
-- Sources: 010_price_lists, 012_company_customers, 013_pricing_items,
--          024_guest_checkout (insert policy + lookup indexes only),
--          042_resolve_product_price, 055_customer_groups,
--          023_company_members (intermediate RLS),
--          062_permissions_enforcement (RLS final state)
-- ============================================================================

-- ############################################################################
-- PART 1: PRICE LISTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: price_lists
-- ----------------------------------------------------------------------------

create table if not exists price_lists (
	id          uuid        default gen_random_uuid() primary key,
	company_id  uuid        not null references companies (id) on delete cascade,
	name        text        not null,
	code        text        not null,
	description text,
	is_default  boolean     default false,
	is_active   boolean     default true,
	sort_order  integer     default 0,
	created_at  timestamptz default now(),
	updated_at  timestamptz default now(),

	unique (company_id, code)
);

comment on table  price_lists            is 'Price lists for customer pricing tiers';
comment on column price_lists.code       is 'Unique code for the price list within a company';
comment on column price_lists.is_default is 'Default price list for customers without assigned list';

-- ----------------------------------------------------------------------------
-- Indexes (price_lists)
-- Removed idx_price_lists_company_id — covered by unique (company_id, code).
-- Upgraded the default index to UNIQUE to enforce one default per company.
-- ----------------------------------------------------------------------------

create unique index idx_price_lists_one_default
	on price_lists (company_id)
	where is_default = true;

-- ----------------------------------------------------------------------------
-- Function: ensure_single_default_price_list
-- Swaps the existing default before setting a new one. Works with the unique
-- partial index above — the old default is unset before the new row commits.
-- ----------------------------------------------------------------------------

create or replace function ensure_single_default_price_list()
	returns trigger
	language plpgsql
	set search_path = ''
as $$
begin
	if NEW.is_default = true then
		update public.price_lists
		set is_default = false
		where company_id = NEW.company_id
		  and id != NEW.id
		  and is_default = true;
	end if;
	return NEW;
end;
$$;

comment on function ensure_single_default_price_list() is 'Ensures only one default price list per company';

-- ----------------------------------------------------------------------------
-- RLS (price_lists) — final state from 062 + customer read from 013
-- Two SELECT policies: member/public access + customer access to assigned list.
-- The customer read policy is deferred to after company_customers creation.
-- ----------------------------------------------------------------------------

alter table price_lists enable row level security;
alter table price_lists force row level security;

create policy "price_lists: anon read defaults"
	on price_lists
	for select
	to anon
	using (is_default = true and is_active = true);

-- NOTE: "price_lists: customer read" policy is deferred to after
-- company_customers table creation (see below PART 3) to avoid
-- forward-referencing a table that doesn't exist yet.

create policy "price_lists: member insert"
	on price_lists
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

create policy "price_lists: member update"
	on price_lists
	for update
	to authenticated
	using (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())))
	with check (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

create policy "price_lists: member delete"
	on price_lists
	for delete
	to authenticated
	using (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Triggers (price_lists)
-- ----------------------------------------------------------------------------

create trigger set_price_lists_updated_at
	before update on price_lists
	for each row
	execute function update_timestamp();

create trigger ensure_single_default_price_list_trigger
	before insert or update on price_lists
	for each row
	execute function ensure_single_default_price_list();

-- ############################################################################
-- PART 2: CUSTOMER GROUPS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: customer_groups
-- Must be created before company_customers (FK dependency on group_id).
-- ----------------------------------------------------------------------------

create table if not exists customer_groups (
	id            uuid        default gen_random_uuid() primary key,
	company_id    uuid        not null references companies (id) on delete cascade,
	price_list_id uuid        references price_lists (id) on delete set null,
	name          text        not null,
	slug          text        not null,
	description   text,
	sort_order    integer     default 0,
	created_at    timestamptz default now(),
	updated_at    timestamptz default now(),

	constraint customer_groups_company_slug_unique unique (company_id, slug)
);

comment on table customer_groups is 'Customer groups for segmentation with optional price list assignment';

-- ----------------------------------------------------------------------------
-- Indexes (customer_groups)
-- Removed customer_groups_company_id_idx — covered by unique (company_id, slug).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- RLS (customer_groups) — from 055, unchanged by 062
-- Owners can manage (all ops); all members can view.
-- ----------------------------------------------------------------------------

alter table customer_groups enable row level security;
alter table customer_groups force row level security;

create policy "customer_groups: select"
	on customer_groups
	for select
	to authenticated
	using (has_company_permission(company_id, 'customers:view', (select auth.uid())));

create policy "customer_groups: insert"
	on customer_groups
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'customers:edit', (select auth.uid())));

create policy "customer_groups: update"
	on customer_groups
	for update
	to authenticated
	using (has_company_permission(company_id, 'customers:edit', (select auth.uid())));

create policy "customer_groups: delete"
	on customer_groups
	for delete
	to authenticated
	using (has_company_permission(company_id, 'customers:edit', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (customer_groups)
-- ----------------------------------------------------------------------------

create trigger set_customer_groups_updated_at
	before update on customer_groups
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: COMPANY CUSTOMERS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: company_customers
-- Includes group_id from 055 from day one.
-- ----------------------------------------------------------------------------

create table if not exists company_customers (
	id            uuid        default gen_random_uuid() primary key,
	company_id    uuid        not null references companies (id) on delete cascade,
	user_id       uuid        references users (id) on delete set null,
	price_list_id uuid        references price_lists (id) on delete set null,
	group_id      uuid        references customer_groups (id) on delete set null,
	name          text        not null,
	phone         text,
	email         text,
	notes         text,
	embedding     extensions.vector(1536),
	created_at    timestamptz default now(),
	updated_at    timestamptz default now(),

	unique (company_id, user_id)
);

comment on table  company_customers               is 'Customers of a company with pricing assignments';
comment on column company_customers.user_id       is 'Link to authenticated user (if customer has account)';
comment on column company_customers.price_list_id is 'Assigned price list for customer-specific pricing';
comment on column company_customers.group_id      is 'Customer group for segmentation and group-based pricing';
comment on column company_customers.embedding     is 'Vector embedding for semantic search (1536 dims, OpenAI text-embedding-3-small)';

-- ----------------------------------------------------------------------------
-- Indexes (company_customers)
-- Removed company_customers_company_customer_idx — redundant with PK.
-- ----------------------------------------------------------------------------

create index company_customers_company_idx on company_customers (company_id);

create index customers_embedding_idx
	on company_customers using hnsw (embedding extensions.vector_cosine_ops)
	with (m = 16, ef_construction = 64);

create index company_customers_group_id_idx on company_customers (group_id);

create index company_customers_email_idx
	on company_customers (company_id, email)
	where user_id is null;

create index company_customers_phone_idx
	on company_customers (company_id, phone)
	where user_id is null;

create index idx_company_customers_price_list_user
	on company_customers (price_list_id, user_id)
	where price_list_id is not null;

-- ----------------------------------------------------------------------------
-- RLS (company_customers) — final state from 012 + 024 + 062
-- Self-access for customers + member access for company staff.
-- INSERT updated: is_company_owner -> is_company_member, anonymous support removed.
-- ----------------------------------------------------------------------------

alter table company_customers enable row level security;
alter table company_customers force row level security;

create policy "company_customers: select"
	on company_customers
	for select
	to authenticated
	using (
		user_id = (select auth.uid())
		or has_company_permission(company_id, 'customers:view', (select auth.uid()))
	);

create policy "company_customers: authenticated insert"
	on company_customers
	for insert
	to authenticated
	with check (
		user_id = (select auth.uid())
		or has_company_permission(company_id, 'customers:create', (select auth.uid()))
	);

create policy "company_customers: update"
	on company_customers
	for update
	to authenticated
	using (
		user_id = (select auth.uid())
		or has_company_permission(company_id, 'customers:edit', (select auth.uid()))
	)
	with check (
		user_id = (select auth.uid())
		or has_company_permission(company_id, 'customers:edit', (select auth.uid()))
	);

create policy "company_customers: member delete"
	on company_customers
	for delete
	to authenticated
	using (has_company_permission(company_id, 'customers:delete', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (company_customers)
-- ----------------------------------------------------------------------------

create trigger customers_update_timestamp
	before update on company_customers
	for each row
	execute function update_timestamp();

-- ----------------------------------------------------------------------------
-- Deferred RLS (price_lists) — requires company_customers to exist
-- ----------------------------------------------------------------------------

create policy "price_lists: authenticated read"
	on price_lists
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'price_lists:view', (select auth.uid()))
		or (is_default = true and is_active = true)
		or exists (
			select 1 from company_customers cc
			where cc.price_list_id = price_lists.id
			  and cc.user_id = (select auth.uid())
		)
	);

-- ############################################################################
-- PART 4: PRICE LIST ITEMS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: price_list_items
-- ----------------------------------------------------------------------------

create table if not exists price_list_items (
	id            uuid           default gen_random_uuid() primary key,
	company_id    uuid           not null references companies (id) on delete cascade,
	price_list_id uuid           not null references price_lists (id) on delete cascade,
	product_id    uuid           not null references products (id) on delete cascade,
	price         numeric(10, 2) not null,
	created_at    timestamptz    default now(),
	updated_at    timestamptz    default now(),

	unique (price_list_id, product_id),

	constraint price_list_items_price_check check (price >= 0)
);

comment on table price_list_items is 'Product prices within each price list';

-- ----------------------------------------------------------------------------
-- Indexes (price_list_items)
-- Removed idx_price_list_items_price_list_id — covered by unique
-- (price_list_id, product_id).
-- ----------------------------------------------------------------------------

create index idx_price_list_items_company_id on price_list_items (company_id);
create index idx_price_list_items_product_id on price_list_items (product_id);

-- ----------------------------------------------------------------------------
-- RLS (price_list_items) — final state from 062
-- Members see all; customers see their assigned list; public sees defaults.
-- ----------------------------------------------------------------------------

alter table price_list_items enable row level security;
alter table price_list_items force row level security;

create policy "price_list_items: member and public read"
	on price_list_items
	for select
	to authenticated, anon
	using (
		has_company_permission(company_id, 'price_lists:view', (select auth.uid()))
		or exists (
			select 1 from company_customers cc
			where cc.price_list_id = price_list_items.price_list_id
			  and cc.user_id = (select auth.uid())
		)
		or exists (
			select 1 from price_lists pl
			where pl.id = price_list_items.price_list_id
			  and pl.is_default = true
			  and pl.is_active = true
		)
	);

create policy "price_list_items: member insert"
	on price_list_items
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

create policy "price_list_items: member update"
	on price_list_items
	for update
	to authenticated
	using (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())))
	with check (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

create policy "price_list_items: member delete"
	on price_list_items
	for delete
	to authenticated
	using (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (price_list_items)
-- ----------------------------------------------------------------------------

create trigger set_price_list_items_updated_at
	before update on price_list_items
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 5: CUSTOMER PRODUCT PRICES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: customer_product_prices
-- Individual customer price overrides (highest priority in pricing hierarchy).
-- ----------------------------------------------------------------------------

create table if not exists customer_product_prices (
	id          uuid           default gen_random_uuid() primary key,
	company_id  uuid           not null references companies (id) on delete cascade,
	customer_id uuid           not null references company_customers (id) on delete cascade,
	product_id  uuid           not null references products (id) on delete cascade,
	price       numeric(10, 2) not null,
	created_at  timestamptz    default now(),
	updated_at  timestamptz    default now(),

	unique (customer_id, product_id),

	constraint customer_product_prices_price_check check (price >= 0)
);

comment on table customer_product_prices is 'Individual customer price overrides (highest priority)';

-- ----------------------------------------------------------------------------
-- Indexes (customer_product_prices)
-- Removed idx_customer_product_prices_customer_id — covered by unique
-- (customer_id, product_id).
-- ----------------------------------------------------------------------------

create index idx_customer_product_prices_company_id on customer_product_prices (company_id);
create index idx_customer_product_prices_product_id on customer_product_prices (product_id);

-- ----------------------------------------------------------------------------
-- RLS (customer_product_prices) — final state from 062
-- Members see all; customers see their own overrides.
-- ----------------------------------------------------------------------------

alter table customer_product_prices enable row level security;
alter table customer_product_prices force row level security;

create policy "customer_product_prices: member and self read"
	on customer_product_prices
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'price_lists:view', (select auth.uid()))
		or exists (
			select 1 from company_customers cc
			where cc.id = customer_product_prices.customer_id
			  and cc.user_id = (select auth.uid())
		)
	);

create policy "customer_product_prices: member insert"
	on customer_product_prices
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

create policy "customer_product_prices: member update"
	on customer_product_prices
	for update
	to authenticated
	using (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())))
	with check (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

create policy "customer_product_prices: member delete"
	on customer_product_prices
	for delete
	to authenticated
	using (has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (customer_product_prices)
-- ----------------------------------------------------------------------------

create trigger set_customer_product_prices_updated_at
	before update on customer_product_prices
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 6: PRICING HIERARCHY RESOLVER
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: resolve_product_price
-- Resolves the effective price for a product using a 5-level priority:
--   1. Customer-specific override (customer_product_prices)
--   2. Customer's assigned price list
--   3. Customer's group price list
--   4. Company default price list
--   5. Base product price
-- Returns jsonb with { price, source } indicating which level was used.
-- STABLE, NOT SECURITY DEFINER — reads via caller's RLS context.
-- ----------------------------------------------------------------------------

create or replace function resolve_product_price(
	p_product_id uuid,
	p_company_id uuid,
	p_customer_id uuid,
	p_customer_price_list_id uuid,
	p_group_price_list_id uuid,
	p_default_price_list_id uuid,
	p_base_price numeric
) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	v_price numeric;
begin
	if p_customer_id is not null then
		select price into v_price
		from public.customer_product_prices
		where customer_id = p_customer_id and product_id = p_product_id;

		if v_price is not null then
			return jsonb_build_object('price', v_price, 'source', 'customer_override');
		end if;
	end if;

	if p_customer_price_list_id is not null then
		select price into v_price
		from public.price_list_items
		where price_list_id = p_customer_price_list_id and product_id = p_product_id;

		if v_price is not null then
			return jsonb_build_object('price', v_price, 'source', 'price_list');
		end if;
	end if;

	if p_group_price_list_id is not null then
		select price into v_price
		from public.price_list_items
		where price_list_id = p_group_price_list_id and product_id = p_product_id;

		if v_price is not null then
			return jsonb_build_object('price', v_price, 'source', 'group_price_list');
		end if;
	end if;

	if p_default_price_list_id is not null then
		select price into v_price
		from public.price_list_items
		where price_list_id = p_default_price_list_id and product_id = p_product_id;

		if v_price is not null then
			return jsonb_build_object('price', v_price, 'source', 'default_price_list');
		end if;
	end if;

	return jsonb_build_object('price', p_base_price, 'source', 'base');
end;
$$;

comment on function resolve_product_price is 'Resolves product price using pricing hierarchy: customer override -> customer price list -> group price list -> default price list -> base price';

grant execute on function resolve_product_price to authenticated;
