-- ============================================================================
-- Migration: company_keywords
-- Description: Add keywords text[] to companies for Instagram-style free-form
--              tags. Update FTS to include keywords.
-- Dependencies: companies (003)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Immutable helper for array-to-string (needed for generated columns)
-- ----------------------------------------------------------------------------

create or replace function immutable_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
as $$
  select array_to_string(arr, sep);
$$;

-- ----------------------------------------------------------------------------
-- 2. Add keywords column
-- ----------------------------------------------------------------------------

alter table companies
  add column if not exists keywords text[] default '{}';

create index idx_companies_keywords on companies using gin (keywords);

-- ----------------------------------------------------------------------------
-- 3. Recreate FTS generated column to include keywords
-- The fts column is GENERATED ALWAYS so it must be dropped and re-added.
-- The GIN index idx_companies_fts is dropped automatically (depends on column).
-- ----------------------------------------------------------------------------

alter table companies drop column fts;

alter table companies
  add column fts tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(bio, '')),  'B') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(area, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(immutable_array_to_string(keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(address, '')), 'C')
  ) stored;

create index idx_companies_fts on companies using gin (fts);
