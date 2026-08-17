-- ============================================================================
-- Migration: products
-- Description: Product ecosystem — categories, unit types, products (with FTS,
--              embedding, inventory, likes_count), product images, product
--              comments with threaded replies, and supporting views.
--              Includes the products_count trigger that maintains companies.products_count.
-- Dependencies: companies, company_statuses, users, core_functions (update_timestamp),
--              company_members (is_company_member, is_company_owner, is_anonymous_user),
--              extensions (pgvector, pg_trgm)
-- Sources: 008_product_categories, 009_unit_types, 011_products,
--          025_product_images, 026_product_comments,
--          080_browse_fts (products FTS column + indexes),
--          086_denormalize_counts (likes_count column + products_count trigger),
--          062_permissions_enforcement (RLS final state)
-- ============================================================================

-- ############################################################################
-- PART 1: PRODUCT CATEGORIES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: product_categories
-- ----------------------------------------------------------------------------

create table if not exists product_categories (
	id         uuid        default gen_random_uuid() primary key,
	company_id uuid        not null references companies (id) on delete cascade,
	name       text        not null,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

comment on table product_categories is 'Product categories for organizing company products';

-- ----------------------------------------------------------------------------
-- Indexes (product_categories)
-- ----------------------------------------------------------------------------

create unique index idx_product_categories_company_name on product_categories (company_id, name);

-- ----------------------------------------------------------------------------
-- RLS (product_categories) — public read + member write (final state from 062)
-- ----------------------------------------------------------------------------

alter table product_categories enable row level security;
alter table product_categories force row level security;

create policy "product_categories: public read"
	on product_categories
	for select
	using (true);

create policy "product_categories: member insert"
	on product_categories
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'categories:manage', (select auth.uid())));

create policy "product_categories: member update"
	on product_categories
	for update
	to authenticated
	using (has_company_permission(company_id, 'categories:manage', (select auth.uid())))
	with check (has_company_permission(company_id, 'categories:manage', (select auth.uid())));

create policy "product_categories: member delete"
	on product_categories
	for delete
	to authenticated
	using (has_company_permission(company_id, 'categories:manage', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (product_categories)
-- ----------------------------------------------------------------------------

create trigger trigger_update_product_categories_timestamp
	before update on product_categories
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 2: UNIT TYPES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: unit_types
-- ----------------------------------------------------------------------------

create table if not exists unit_types (
	id         uuid        default gen_random_uuid() primary key,
	company_id uuid        not null references companies (id) on delete cascade,
	code       text        not null,
	name       text        not null,
	symbol     text,
	is_default boolean     default false,
	sort_order integer     default 0,
	created_at timestamptz default now(),
	updated_at timestamptz default now(),

	unique (company_id, code)
);

comment on table  unit_types        is 'Unit types for product pricing (kg, piece, liter, etc.)';
comment on column unit_types.code   is 'Short code for the unit (e.g., kg, pc, l)';
comment on column unit_types.symbol is 'Display symbol for the unit';

-- ----------------------------------------------------------------------------
-- Indexes (unit_types)
-- ----------------------------------------------------------------------------

create index idx_unit_types_company_id on unit_types (company_id);

-- ----------------------------------------------------------------------------
-- RLS (unit_types) — member-only, all ops (final state from 062)
-- ----------------------------------------------------------------------------

alter table unit_types enable row level security;
alter table unit_types force row level security;

create policy "unit_types: member select"
	on unit_types
	for select
	to authenticated
	using (has_company_permission(company_id, 'products:view', (select auth.uid())));

create policy "unit_types: member insert"
	on unit_types
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:units', (select auth.uid())));

create policy "unit_types: member update"
	on unit_types
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:units', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:units', (select auth.uid())));

create policy "unit_types: member delete"
	on unit_types
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:units', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (unit_types)
-- ----------------------------------------------------------------------------

create trigger set_unit_types_updated_at
	before update on unit_types
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: PRODUCTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: products
-- All columns from day one: base (011) + fts (080) + likes_count (086)
-- ----------------------------------------------------------------------------

create table if not exists products (
	id                  uuid           default gen_random_uuid() primary key,
	company_id          uuid           not null references companies (id) on delete cascade,
	name                text           not null,
	description         text,
	price               numeric(10, 2) not null,
	unit_type_id        uuid           references unit_types (id) on delete set null,
	hide_price          boolean        default false,
	weight              text,
	size                text,
	image_url           text,
	category_id         uuid           references product_categories (id) on delete set null,
	status_id           uuid           references company_statuses (id) on delete set null,
	stock_quantity      integer        default 0,
	track_inventory     boolean        default true,
	low_stock_threshold integer        default 5,
	allow_backorders    boolean        default false,
	likes_count         int            not null default 0,
	embedding           extensions.vector(1536),
	fts                 tsvector       generated always as (
		setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
		setweight(to_tsvector('simple', coalesce(description, '')), 'B')
	) stored,
	created_at          timestamptz    default now(),
	updated_at          timestamptz    default now(),

	constraint products_stock_quantity_check
		check (stock_quantity >= 0 or not track_inventory)
);

comment on table  products                     is 'Products available for sale by a company';
comment on column products.stock_quantity      is 'Current stock quantity. Only enforced if track_inventory is true.';
comment on column products.track_inventory     is 'Whether to track and enforce inventory limits for this product.';
comment on column products.low_stock_threshold is 'Threshold for low stock warnings.';
comment on column products.allow_backorders    is 'Allow orders even when stock is 0 (future use).';
comment on column products.likes_count         is 'Trigger-maintained count of likes from product_likes';
comment on column products.embedding           is 'Vector embedding for semantic search (1536 dims, OpenAI text-embedding-3-small)';
comment on column products.fts                 is 'Auto-generated tsvector for full-text search (name, description)';

-- ----------------------------------------------------------------------------
-- Indexes (products) — from 011, 080
-- ----------------------------------------------------------------------------

create index idx_products_company_id on products (company_id);
create unique index idx_products_company_name on products (company_id, name);
create index idx_products_category_id on products (category_id);
create index idx_products_status_id on products (status_id);
create index idx_products_created_at on products (created_at);
create index idx_products_price on products (price);

create index idx_products_stock_quantity on products (stock_quantity)
	where track_inventory = true;

create index products_embedding_idx
	on products using hnsw (embedding extensions.vector_cosine_ops)
	with (m = 16, ef_construction = 64);

create index idx_products_fts on products using gin (fts);
create index idx_products_name_trgm on products using gin (name extensions.gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- RLS (products) — public read + member write (final state from 062)
-- ----------------------------------------------------------------------------

alter table products enable row level security;
alter table products force row level security;

create policy "products: public read"
	on products
	for select
	using (true);

create policy "products: member insert"
	on products
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'products:create', (select auth.uid())));

create policy "products: member update"
	on products
	for update
	to authenticated
	using (has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'products:edit', (select auth.uid())));

create policy "products: member delete"
	on products
	for delete
	to authenticated
	using (has_company_permission(company_id, 'products:delete', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (products — timestamp)
-- ----------------------------------------------------------------------------

create trigger trigger_update_products_timestamp
	before update on products
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 4: PRODUCT IMAGES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: product_images
-- ----------------------------------------------------------------------------

create table if not exists product_images (
	id            uuid        default gen_random_uuid() primary key,
	product_id    uuid        not null references products (id) on delete cascade,
	company_id    uuid        not null references companies (id) on delete cascade,
	image_url     text        not null,
	display_order integer     not null default 1,
	is_primary    boolean     not null default false,
	created_at    timestamptz default now(),
	updated_at    timestamptz default now()
);

comment on table  product_images               is 'Multiple images for products with ordering and primary image selection';
comment on column product_images.display_order is 'Order in which images are displayed (lower numbers first)';
comment on column product_images.is_primary    is 'Primary/main image for the product';

-- ----------------------------------------------------------------------------
-- Indexes (product_images)
-- ----------------------------------------------------------------------------

create index idx_product_images_display_order on product_images (product_id, display_order);

create unique index idx_product_images_primary
	on product_images (product_id)
	where is_primary = true;

-- ----------------------------------------------------------------------------
-- RLS (product_images) — public read + member write
-- Updated from is_company_owner to is_company_member for consistency with 062.
-- The original insert policy used a complex EXISTS subquery through products;
-- since product_images has its own company_id, is_company_member suffices.
-- ----------------------------------------------------------------------------

alter table product_images enable row level security;
alter table product_images force row level security;

create policy "product_images: public read"
	on product_images
	for select
	using (true);

create policy "product_images: member insert"
	on product_images
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'products:edit', (select auth.uid())));

create policy "product_images: member update"
	on product_images
	for update
	to authenticated
	using (has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'products:edit', (select auth.uid())));

create policy "product_images: member delete"
	on product_images
	for delete
	to authenticated
	using (has_company_permission(company_id, 'products:edit', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (product_images)
-- ----------------------------------------------------------------------------

create trigger trigger_update_product_images_timestamp
	before update on product_images
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 5: PRODUCT COMMENTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: product_comments
-- ----------------------------------------------------------------------------

create table if not exists product_comments (
	id               uuid        default gen_random_uuid() primary key,
	product_id       uuid        not null references products (id) on delete cascade,
	company_id       uuid        not null references companies (id) on delete cascade,
	user_id          uuid        not null references users (id) on delete cascade,
	parent_id        uuid        references product_comments (id) on delete cascade,
	content          text        not null check (char_length(content) <= 1000),
	is_company_reply boolean     not null default false,
	created_at       timestamptz default now(),
	updated_at       timestamptz default now()
);

comment on table  product_comments                  is 'Product comments and Q&A with threaded replies';
comment on column product_comments.parent_id        is 'Parent comment ID for replies (null for top-level comments)';
comment on column product_comments.is_company_reply is 'True if comment is from company owner/employee';
comment on column product_comments.content          is 'Comment content (max 1000 characters)';

-- ----------------------------------------------------------------------------
-- Indexes (product_comments)
-- ----------------------------------------------------------------------------

create index idx_product_comments_product_id on product_comments (product_id);
create index idx_product_comments_user_id on product_comments (user_id);
create index idx_product_comments_parent_id on product_comments (parent_id);
create index idx_product_comments_created_at on product_comments (product_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS (product_comments) — public read, authenticated insert, owner update/delete
-- Final state from 026 (062 did not modify these policies). The asymmetry is
-- intentional: any member can reply, but only owners can moderate/delete.
-- ----------------------------------------------------------------------------

alter table product_comments enable row level security;
alter table product_comments force row level security;

create policy "product_comments: public read"
	on product_comments
	for select
	using (true);

create policy "product_comments: authenticated insert"
	on product_comments
	for insert
	to authenticated
	with check (
		user_id = (select auth.uid())
		and not is_anonymous_user()
		and (
			(is_company_reply = false)
			or
			(is_company_reply = true and has_company_permission(company_id, 'products:view', (select auth.uid())))
		)
	);

create policy "product_comments: owner update"
	on product_comments
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "product_comments: delete"
	on product_comments
	for delete
	to authenticated
	using (
		user_id = (select auth.uid())
		or has_company_permission(company_id, 'products:delete', (select auth.uid()))
	);

-- ----------------------------------------------------------------------------
-- Trigger (product_comments)
-- ----------------------------------------------------------------------------

create trigger trigger_update_product_comments_timestamp
	before update on product_comments
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 6: VIEWS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- View: products_view
-- Products with joined category, status, unit type, and primary image.
-- ----------------------------------------------------------------------------

create or replace view public.products_view
with (security_invoker = on)
as
select
	products.company_id,
	products.id,
	products.name,
	products.description,
	products.price,
	products.hide_price,
	(
		select pi.image_url
		from product_images pi
		where pi.product_id = products.id
		  and pi.is_primary = true
		limit 1
	) as image_url,
	products.stock_quantity,
	products.track_inventory,
	products.low_stock_threshold,
	products.allow_backorders,
	products.updated_at,
	products.created_at,
	product_categories.name as category,
	cs.name                 as status,
	cs.code                 as status_code,
	cs.color                as status_color,
	cs.icon                 as status_icon,
	ut.id                   as unit_type_id,
	ut.code                 as unit_type_code,
	ut.name                 as unit_type_name,
	ut.symbol               as unit_type_symbol
from products
	left join product_categories on products.category_id = product_categories.id
	left join company_statuses cs on products.status_id = cs.id
	left join unit_types ut on products.unit_type_id = ut.id;

comment on view public.products_view is 'Products with joined category, status, unit type, and primary image information';

-- ----------------------------------------------------------------------------
-- View: product_comments_view
-- Comments with user display information.
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
	coalesce(u.name || ' ' || u.last_name, u.email, 'Anonymous') as user_name,
	u.avatar as user_avatar
from product_comments pc
left join users u on pc.user_id = u.id;

comment on view product_comments_view is 'Product comments with user display information';

-- ############################################################################
-- PART 7: PRODUCTS COUNT TRIGGER (from 086)
-- Maintains companies.products_count based on product status changes.
-- ############################################################################

-- BUG FIX: Original queried company_statuses without company_id filter,
-- returning the wrong active status in multi-company setups. Now scoped
-- to the product's own company.
create or replace function trg_update_products_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_active_id uuid;
begin
	select id into v_active_id
	from public.company_statuses
	where company_id = coalesce(new.company_id, old.company_id)
	  and entity_type = 'product'
	  and code = 'active';

	if tg_op = 'INSERT' and new.status_id = v_active_id then
		update public.companies set products_count = products_count + 1 where id = new.company_id;
	elsif tg_op = 'DELETE' and old.status_id = v_active_id then
		update public.companies set products_count = greatest(0, products_count - 1) where id = old.company_id;
	elsif tg_op = 'UPDATE' then
		if old.status_id is distinct from new.status_id then
			if old.status_id != v_active_id and new.status_id = v_active_id then
				update public.companies set products_count = products_count + 1 where id = new.company_id;
			elsif old.status_id = v_active_id and new.status_id != v_active_id then
				update public.companies set products_count = greatest(0, products_count - 1) where id = new.company_id;
			end if;
		end if;
	end if;

	return coalesce(new, old);
end;
$$;

comment on function trg_update_products_count() is
	'Maintains companies.products_count — increments/decrements when a product enters/leaves active status';

create trigger trg_products_count
	after insert or update of status_id or delete on products
	for each row
	execute function trg_update_products_count();

-- ############################################################################
-- REALTIME CONFIGURATION (from 047)
-- ############################################################################

alter publication supabase_realtime add table products;
