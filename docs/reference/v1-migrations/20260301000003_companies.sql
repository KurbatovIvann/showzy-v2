-- ============================================================================
-- Migration: companies
-- Description: Core companies table - the foundation of multi-tenant architecture.
--              Includes all profile, geo, search, and embedding columns from day one.
-- Dependencies: extensions (pgvector, pg_trgm), core_functions (update_timestamp)
-- Sources: 003_companies, 071_company_profile_columns, 078_company_geo_columns,
--          080_browse_fts, 081_company_embeddings, 086_denormalize_counts (cols only)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table Definition
-- ----------------------------------------------------------------------------

create table if not exists companies (
	id              uuid             default gen_random_uuid() primary key,
	name            text             not null,
	email           text,
	phone           text,
	slug            text             unique not null
	                                 constraint chk_companies_slug
	                                 check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
	prefix          text             not null,
	logo_url        text,

	-- Profile (from 071)
	bio             text,
	about_html      text,
	city            text,
	city_ref        text,
	area            text,
	address         text,
	latitude        double precision,
	longitude       double precision,
	working_hours   jsonb,
	reviews_enabled boolean          default true,

	-- Denormalized counters (triggers live in their respective domain migrations)
	products_count  int              not null default 0,
	followers_count int              not null default 0,

	-- AI / Search
	embedding       extensions.vector(1536),
	fts             tsvector         generated always as (
		setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
		setweight(to_tsvector('simple', coalesce(bio, '')),  'B') ||
		setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
		setweight(to_tsvector('simple', coalesce(area, '')), 'B') ||
		setweight(to_tsvector('simple', coalesce(address, '')), 'C')
	) stored,

	created_at      timestamptz      default now(),
	updated_at      timestamptz      default now()
);

comment on table  companies                    is 'Companies/stores in the multi-tenant system';
comment on column companies.slug               is 'URL-friendly unique identifier for public showcase';
comment on column companies.prefix             is 'Prefix for order numbers (auto-generated from name)';
comment on column companies.phone              is 'Company contact phone number';
comment on column companies.bio                is 'Short bio shown in profile header (~200 chars)';
comment on column companies.about_html         is 'Rich-text HTML for the About Us page';
comment on column companies.city               is 'City name (Nova Poshta)';
comment on column companies.city_ref           is 'Nova Poshta city reference ID';
comment on column companies.area               is 'Oblast/region name from Nova Poshta (e.g., "Київська")';
comment on column companies.address            is 'Street address';
comment on column companies.latitude           is 'Latitude from Nova Poshta getSettlements API';
comment on column companies.longitude          is 'Longitude from Nova Poshta getSettlements API';
comment on column companies.working_hours      is 'Structured working hours (JSON)';
comment on column companies.reviews_enabled    is 'Whether the reviews tab is visible on the showcase';
comment on column companies.products_count     is 'Trigger-maintained count of active products';
comment on column companies.followers_count    is 'Trigger-maintained count of followers';
comment on column companies.embedding          is 'Vector embedding for semantic search (1536 dims, OpenAI text-embedding-3-small)';
comment on column companies.fts                is 'Auto-generated tsvector for full-text search (name, bio, city, area, address)';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

-- Unique constraints
create unique index idx_companies_email on companies (email)
	where email is not null;

create unique index idx_companies_name on companies (name);

-- Geo (partial — only index rows with coordinates)
create index idx_companies_latitude on companies (latitude)
	where latitude is not null;

create index idx_companies_longitude on companies (longitude)
	where longitude is not null;

-- Full-text search (GIN)
create index idx_companies_fts on companies using gin (fts);

-- Trigram fuzzy matching on name
create index idx_companies_name_trgm on companies using gin (name extensions.gin_trgm_ops);

-- HNSW vector similarity
create index idx_companies_embedding
	on companies using hnsw (embedding extensions.vector_cosine_ops)
	with (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------

alter table companies enable row level security;
alter table companies force row level security;

create policy "companies: public read access"
	on companies
	for select
	using (true);

create policy "companies: authenticated insert"
	on companies
	for insert
	to authenticated
	with check (not is_anonymous_user());

-- NOTE: Update/delete policies are added in company_members migration
-- to use company_members table for ownership checks.

-- ----------------------------------------------------------------------------
-- Trigger Functions
-- ----------------------------------------------------------------------------

-- Auto-generate company prefix from name
create or replace function set_company_prefix()
	returns trigger
	set search_path = ''
as $$
declare
	company_name    text;
	words           text[];
	computed_prefix text;
begin
	if new.prefix is null then
		company_name := regexp_replace(new.name, '[^a-zA-ZА-Яа-яЇїІіЄєҐґ ]', '', 'g');
		words := string_to_array(trim(company_name), ' ');

		if array_length(words, 1) is null or array_length(words, 1) = 0 then
			computed_prefix := 'CMP';
		elsif array_length(words, 1) = 1 then
			computed_prefix := upper(left(words[1], 3));
		else
			computed_prefix := upper(
				left(words[1], 1) ||
				left(words[2], 1) ||
				right(words[2], 1)
			);
		end if;

		new.prefix := computed_prefix;
	end if;
	return new;
end;
$$ language plpgsql;

comment on function set_company_prefix() is 'Auto-generates company prefix from name for order numbers';

-- Haversine distance (km) between two lat/lng points
create or replace function haversine_km(
	lat1 double precision,
	lng1 double precision,
	lat2 double precision,
	lng2 double precision
) returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
	select 6371.0 * acos(
		least(1.0, greatest(-1.0,
			cos(radians(lat1)) * cos(radians(lat2))
			* cos(radians(lng2) - radians(lng1))
			+ sin(radians(lat1)) * sin(radians(lat2))
		))
	);
$$;

comment on function haversine_km is
	'Great-circle distance in km between two lat/lng points using Haversine formula';

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

create trigger assign_company_prefix
	before insert on companies
	for each row
	execute function set_company_prefix();

create trigger set_companies_updated_at
	before update on companies
	for each row
	execute function update_timestamp();
