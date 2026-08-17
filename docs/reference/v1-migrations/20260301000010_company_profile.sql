-- ============================================================================
-- Migration: company_profile
-- Description: Company profile entities — social links, showcase configuration,
--              business categories (with seed data), and the company_details
--              view that aggregates all profile data with denormalized counts.
-- Dependencies: companies, company_members (is_company_member, is_company_owner),
--               core_functions (update_timestamp)
-- Sources: 005_company_socials, 017_showcase_config (simplified per 071),
--          077_business_categories, 086_denormalize_counts (company_details view)
-- ============================================================================

-- ############################################################################
-- PART 1: COMPANY SOCIALS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: company_socials
-- Fixes from original 005: added NOT NULL to company_id and platform,
-- added created_at + updated_at columns.
-- ----------------------------------------------------------------------------

create table if not exists company_socials (
	id         uuid        default gen_random_uuid() primary key,
	company_id uuid        not null references companies (id) on delete cascade,
	platform   text        not null,
	url        text        not null,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

comment on table  company_socials          is 'Social media links for company showcase pages';
comment on column company_socials.platform is 'Social platform name (e.g., instagram, facebook)';

-- ----------------------------------------------------------------------------
-- Indexes (company_socials)
-- ----------------------------------------------------------------------------

create index idx_company_socials_company_id on company_socials (company_id);

-- ----------------------------------------------------------------------------
-- RLS (company_socials) — from 005 (public read) + 062 (member write)
-- ----------------------------------------------------------------------------

alter table company_socials enable row level security;
alter table company_socials force row level security;

create policy "company_socials: public read"
	on company_socials
	for select
	using (true);

create policy "company_socials: member insert"
	on company_socials
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

create policy "company_socials: member update"
	on company_socials
	for update
	to authenticated
	using (has_company_permission(company_id, 'showcase:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

create policy "company_socials: member delete"
	on company_socials
	for delete
	to authenticated
	using (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (company_socials)
-- ----------------------------------------------------------------------------

create trigger set_company_socials_updated_at
	before update on company_socials
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 2: SHOWCASE CONFIG
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: showcase_config
-- Simplified per 071: dropped layout, draft_sections, draft_theme, draft_seo.
-- Kept theme jsonb for future use.
-- Removed redundant idx_showcase_config_company_id — covered by unique
-- constraint on company_id.
-- ----------------------------------------------------------------------------

create table if not exists showcase_config (
	id         uuid        default gen_random_uuid() primary key,
	company_id uuid        not null references companies (id) on delete cascade unique,
	sections   jsonb       default '{
		"header": {
			"visible": true,
			"order": 0,
			"showLogo": true,
			"showContact": true,
			"showSocials": true
		},
		"hero": {
			"visible": true,
			"order": 1,
			"style": "overlay",
			"title": "",
			"description": "",
			"imageUrl": null,
			"ctaText": "",
			"ctaUrl": "#products"
		},
		"products": {
			"visible": true,
			"order": 2,
			"layout": "grid",
			"showFilters": true
		},
		"footer": {
			"visible": true,
			"order": 3,
			"showLinks": true,
			"showSocials": true
		}
	}'::jsonb,
	theme      jsonb       default '{}'::jsonb,
	seo        jsonb       default '{}'::jsonb,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

comment on table  showcase_config          is 'Showcase page customization for each company';
comment on column showcase_config.sections is 'Published section configuration';
comment on column showcase_config.theme    is 'Published theme settings';
comment on column showcase_config.seo      is 'Published SEO settings (title, description, keywords, ogImage, businessType, noIndex)';

-- ----------------------------------------------------------------------------
-- RLS (showcase_config) — from 017 (public read) + 062 (member write)
-- ----------------------------------------------------------------------------

alter table showcase_config enable row level security;
alter table showcase_config force row level security;

create policy "showcase_config: public read"
	on showcase_config
	for select
	using (true);

create policy "showcase_config: member insert"
	on showcase_config
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

create policy "showcase_config: member update"
	on showcase_config
	for update
	to authenticated
	using (has_company_permission(company_id, 'showcase:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

create policy "showcase_config: member delete"
	on showcase_config
	for delete
	to authenticated
	using (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (showcase_config)
-- ----------------------------------------------------------------------------

create trigger update_showcase_config_updated_at
	before update on showcase_config
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: BUSINESS CATEGORIES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: business_categories
-- Predefined global categories (bilingual EN/UK). System-managed reference
-- data — public read only, no write policies.
-- ----------------------------------------------------------------------------

create table if not exists business_categories (
	id            uuid        default gen_random_uuid() primary key,
	slug          text        not null unique,
	name_en       text        not null,
	name_uk       text        not null,
	icon          text,
	display_order int         default 0,
	is_active     boolean     default true,
	created_at    timestamptz default now()
);

comment on table  business_categories               is 'Predefined global business categories for company classification';
comment on column business_categories.slug           is 'URL-friendly unique identifier';
comment on column business_categories.icon           is 'Lucide icon name for mobile/web UI';
comment on column business_categories.display_order  is 'Sort order for display in category grids';

-- ----------------------------------------------------------------------------
-- RLS (business_categories) — public read only
-- ----------------------------------------------------------------------------

alter table business_categories enable row level security;
alter table business_categories force row level security;

create policy "business_categories: public read"
	on business_categories
	for select
	using (true);

-- ############################################################################
-- PART 4: COMPANY BUSINESS CATEGORIES (junction)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: company_business_categories
-- Many-to-many: a company can belong to multiple categories.
-- ----------------------------------------------------------------------------

create table if not exists company_business_categories (
	company_id  uuid not null references companies (id) on delete cascade,
	category_id uuid not null references business_categories (id) on delete cascade,
	primary key (company_id, category_id)
);

comment on table company_business_categories is 'Links companies to their business categories (many-to-many)';

-- ----------------------------------------------------------------------------
-- Indexes (company_business_categories)
-- ----------------------------------------------------------------------------

create index idx_cbc_category_id on company_business_categories (category_id);

-- ----------------------------------------------------------------------------
-- RLS (company_business_categories) — public read + member write
-- Updated from is_company_owner to is_company_member for consistency.
-- ----------------------------------------------------------------------------

alter table company_business_categories enable row level security;
alter table company_business_categories force row level security;

create policy "company_business_categories: public read"
	on company_business_categories
	for select
	using (true);

create policy "company_business_categories: member insert"
	on company_business_categories
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

create policy "company_business_categories: member delete"
	on company_business_categories
	for delete
	to authenticated
	using (has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

-- ############################################################################
-- PART 5: SEED DATA — BUSINESS CATEGORIES
-- ############################################################################

insert into business_categories (slug, name_en, name_uk, icon, display_order) values
	('confectionery', 'Confectionery',         'Кондитерська',            'cake',        1),
	('bakery',        'Bakery',                'Пекарня',                 'croissant',   2),
	('food',          'Food & Drinks',         'Їжа та напої',            'utensils',    3),
	('flowers',       'Flowers',               'Квіти',                   'flower-2',    4),
	('clothing',      'Clothing & Shoes',      'Одяг та взуття',          'shirt',       5),
	('jewelry',       'Jewelry & Accessories', 'Прикраси та аксесуари',   'gem',         6),
	('beauty',        'Beauty & Cosmetics',    'Краса та косметика',      'sparkles',    7),
	('health',        'Health & Wellness',     'Здоровʼя та добробут',    'heart-pulse', 8),
	('handmade',      'Handmade & Craft',      'Ручна робота',            'palette',     9),
	('home',          'Home & Decor',          'Дім та декор',            'lamp',        10),
	('kids',          'Kids & Baby',           'Дитячі товари',           'baby',        11),
	('sports',        'Sports',                'Спорт',                   'dumbbell',    12),
	('gifts',         'Gifts',                 'Подарунки',               'gift',        13),
	('pets',          'Pets',                  'Зоотовари',               'paw-print',   14),
	('electronics',   'Electronics & Tech',    'Електроніка та техніка',  'smartphone',  15),
	('books',         'Books',                 'Книги',                   'book-open',   16),
	('services',      'Services',              'Послуги',                 'wrench',      17),
	('other',         'Other',                 'Інше',                    'package',     99)
on conflict (slug) do nothing;

-- ############################################################################
-- PART 6: COMPANY DETAILS VIEW (final version from 086)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- View: company_details
-- Aggregates company profile, social links, showcase config, and denormalized
-- counts. Uses jsonb_agg (not json_agg) for proper typed output.
-- Reads products_count and followers_count directly from companies table
-- (no lateral joins).
-- Includes c.updated_at (added to companies in 003, absent from original 086).
-- ----------------------------------------------------------------------------

create view public.company_details with (security_invoker = on) as
select
	c.id,
	c.name,
	c.email,
	c.phone,
	c.slug,
	c.logo_url,
	c.bio,
	c.about_html,
	c.city,
	c.city_ref,
	c.area,
	c.address,
	c.latitude,
	c.longitude,
	c.working_hours,
	c.reviews_enabled,
	c.created_at,
	c.updated_at,
	coalesce(
		jsonb_agg(
			jsonb_build_object('id', cs.id, 'platform', cs.platform, 'url', cs.url)
		) filter (where cs.id is not null),
		'[]'::jsonb
	) as socials,
	sc.sections as showcase_sections,
	sc.theme    as showcase_theme,
	sc.seo      as showcase_seo,
	c.products_count,
	c.followers_count
from companies c
	left join company_socials cs on c.id = cs.company_id
	left join showcase_config sc on c.id = sc.company_id
group by c.id, sc.sections, sc.theme, sc.seo;

comment on view public.company_details is
	'Company information with profile, geo data, social links, showcase configuration, and denormalized counts';
