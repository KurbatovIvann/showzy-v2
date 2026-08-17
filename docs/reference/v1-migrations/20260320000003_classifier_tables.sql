-- ============================================================================
-- Migration: classifier_tables
-- Description: Creates reference tables for Ukrainian national classifiers:
--              kved_codes (ДК 009:2010, KVED) and cpv_codes (ДК 021:2015, CPV).
--              Both are read-only, publicly accessible, with full-text search.
-- Dependencies: none (standalone reference tables)
-- ============================================================================

-- ############################################################################
-- PART 1: KVED CODES (ДК 009:2010)
-- ############################################################################

create table public.kved_codes (
  code          text     primary key,
  name_uk       text     not null,
  level         smallint not null,
  parent_code   text     references public.kved_codes (code),
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(code, '') || ' ' || coalesce(name_uk, ''))
  ) stored
);

comment on table  public.kved_codes             is 'KVED ДК 009:2010 classification of economic activities (identical to NACE Rev. 2)';
comment on column public.kved_codes.code        is 'Section letter (A-U), division (01-99), group (01.1), or class (01.11)';
comment on column public.kved_codes.level       is '1=section, 2=division, 3=group, 4=class';
comment on column public.kved_codes.parent_code is 'FK to parent level in the hierarchy (null for sections)';

-- ----------------------------------------------------------------------------
-- Indexes (kved_codes)
-- ----------------------------------------------------------------------------

create index idx_kved_codes_parent_code   on public.kved_codes (parent_code);
create index idx_kved_codes_level         on public.kved_codes (level);
create index idx_kved_codes_search_vector on public.kved_codes using gin (search_vector);

-- ----------------------------------------------------------------------------
-- RLS (kved_codes) — public read only, system-managed reference data
-- ----------------------------------------------------------------------------

alter table public.kved_codes enable row level security;
alter table public.kved_codes force row level security;

create policy "kved_codes: public read"
  on public.kved_codes
  for select
  using (true);

-- ############################################################################
-- PART 2: CPV CODES (ДК 021:2015)
-- ############################################################################

create table public.cpv_codes (
  code          text     primary key,
  name_uk       text     not null,
  name_en       text,
  level         smallint not null,
  parent_code   text     references public.cpv_codes (code),
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(code, '') || ' ' || coalesce(name_uk, '') || ' ' || coalesce(name_en, ''))
  ) stored
);

comment on table  public.cpv_codes             is 'CPV ДК 021:2015 unified procurement vocabulary (identical to EU CPV 2008)';
comment on column public.cpv_codes.code        is 'Full CPV code with check digit (e.g. 03000000-1)';
comment on column public.cpv_codes.level       is '1=division (XX), 2=group (XXX), 3=class (XXXX), 4=category (XXXXX), 5+=deeper';
comment on column public.cpv_codes.parent_code is 'FK to parent level in the hierarchy (null for divisions)';

-- ----------------------------------------------------------------------------
-- Indexes (cpv_codes)
-- ----------------------------------------------------------------------------

create index idx_cpv_codes_parent_code   on public.cpv_codes (parent_code);
create index idx_cpv_codes_level         on public.cpv_codes (level);
create index idx_cpv_codes_search_vector on public.cpv_codes using gin (search_vector);

-- ----------------------------------------------------------------------------
-- RLS (cpv_codes) — public read only, system-managed reference data
-- ----------------------------------------------------------------------------

alter table public.cpv_codes enable row level security;
alter table public.cpv_codes force row level security;

create policy "cpv_codes: public read"
  on public.cpv_codes
  for select
  using (true);
