-- ============================================================================
-- Migration: company_legal_info
-- Description: Dedicated table for FOP / legal entity data used by documents
--              and checkout bank transfer display. Replaces the bank_* columns
--              that were on payment_settings. Includes company_type (FOP/TOV),
--              and atomic onboarding RPC for company creation.
-- Consolidates: 20260323000001 + 20260326000001 (company_type) + 20260326000002
-- Dependencies: companies, core_functions (update_timestamp),
--               company_members (has_company_permission), payment_settings
-- ============================================================================

-- ############################################################################
-- PART 1: TABLE
-- ############################################################################

create table if not exists company_legal_info (
	id            uuid        default gen_random_uuid() primary key,
	company_id    uuid        not null references companies (id) on delete cascade unique,
	company_type  text        not null default 'fop'
	                          constraint chk_company_legal_info_company_type
	                          check (company_type in ('fop', 'tov')),
	legal_name    text,
	edrpou        text,
	legal_address text,
	iban          text,
	bank_name     text,
	bank_mfo      text,
	bank_edrpou   text,
	phone         text,
	email         text,
	created_at    timestamptz not null default now(),
	updated_at    timestamptz not null default now()
);

comment on table  company_legal_info                 is 'FOP / legal entity data for documents and checkout';
comment on column company_legal_info.company_type    is 'Legal entity type: fop (sole proprietor) or tov (LLC). FOP by default.';
comment on column company_legal_info.legal_name      is 'Official FOP/entity name, e.g. "ФОП Іванов І.І."';
comment on column company_legal_info.edrpou          is 'ЄДРПОУ or ІПН tax identifier (8-10 digits)';
comment on column company_legal_info.legal_address   is 'Legal/registration address';
comment on column company_legal_info.iban            is 'Bank account IBAN (UA + 27 digits)';
comment on column company_legal_info.bank_name       is 'Bank name';
comment on column company_legal_info.bank_mfo        is 'Bank MFO routing code (6 digits)';
comment on column company_legal_info.bank_edrpou     is 'Bank ЄДРПОУ code (8 digits)';
comment on column company_legal_info.phone           is 'Contact phone for documents (may differ from company profile)';
comment on column company_legal_info.email           is 'Contact email for documents (may differ from company profile)';

-- ############################################################################
-- PART 2: RLS
-- ############################################################################

alter table company_legal_info enable row level security;
alter table company_legal_info force row level security;

create policy "company_legal_info: member select"
	on company_legal_info
	for select
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

create policy "company_legal_info: member insert"
	on company_legal_info
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

create policy "company_legal_info: member update"
	on company_legal_info
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

-- ############################################################################
-- PART 3: TRIGGER
-- ############################################################################

create trigger company_legal_info_update_timestamp
	before update on company_legal_info
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 4: SEED FROM EXISTING payment_settings DATA
-- ############################################################################

insert into company_legal_info (
	company_id, legal_name, edrpou, iban, bank_name, bank_mfo, bank_edrpou
)
select
	ps.company_id,
	ps.bank_recipient,
	ps.bank_recipient_tax_id,
	ps.bank_iban,
	ps.bank_name,
	ps.bank_mfo,
	ps.bank_edrpou
from payment_settings ps
where ps.company_id is not null
on conflict (company_id) do nothing;

-- ############################################################################
-- PART 5: DROP bank_* COLUMNS FROM payment_settings
-- ############################################################################

alter table payment_settings
	drop column if exists bank_name,
	drop column if exists bank_iban,
	drop column if exists bank_recipient,
	drop column if exists bank_recipient_tax_id,
	drop column if exists bank_mfo,
	drop column if exists bank_edrpou;

-- ############################################################################
-- PART 6: UPDATE get_checkout_payment_info RPC
-- ############################################################################

drop function if exists get_checkout_payment_info(uuid);

create or replace function get_checkout_payment_info(p_company_id uuid)
returns table (
	enabled_methods text[],
	legal_name      text,
	edrpou          text,
	iban            text,
	bank_name       text,
	bank_mfo        text,
	bank_edrpou     text,
	bank_notes      text,
	bank_reference_template text
)
security definer
stable
language sql
set search_path = ''
as $$
	select
		ps.enabled_methods,
		cli.legal_name,
		cli.edrpou,
		cli.iban,
		cli.bank_name,
		cli.bank_mfo,
		cli.bank_edrpou,
		ps.bank_notes,
		ps.bank_reference_template
	from public.payment_settings ps
	left join public.company_legal_info cli on cli.company_id = ps.company_id
	where ps.company_id = p_company_id;
$$;

comment on function get_checkout_payment_info(uuid) is
	'Returns checkout-relevant payment + legal info for a company (joins company_legal_info for bank details)';

-- ############################################################################
-- PART 7: CREATE COMPANY ONBOARDING RPC
-- ############################################################################

create or replace function create_company_onboarding(
  p_user_id uuid,
  p_name text,
  p_slug text,
  p_prefix text,
  p_email text default null,
  p_city text default null,
  p_city_ref text default null,
  p_area text default null,
  p_address text default null,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company record;
begin
  if p_user_id != (select auth.uid()) then
    raise exception 'UNAUTHORIZED';
  end if;

  if (select public.is_anonymous_user()) then
    raise exception 'ANONYMOUS_NOT_ALLOWED';
  end if;

  if (
    select count(*) from public.company_members
    where user_id = p_user_id and role = 'owner'
  ) >= 2 then
    raise exception 'MAX_COMPANIES_REACHED';
  end if;

  if exists (
    select 1 from public.companies where slug = p_slug
  ) then
    raise exception 'SLUG_TAKEN';
  end if;

  insert into public.companies (name, email, slug, prefix, city, city_ref, area, address, latitude, longitude)
  values (p_name, p_email, p_slug, p_prefix, p_city, p_city_ref, p_area, p_address, p_latitude, p_longitude)
  returning id, name, slug into v_company;

  insert into public.company_members (company_id, user_id, role)
  values (v_company.id, p_user_id, 'owner');

  return jsonb_build_object(
    'id', v_company.id,
    'slug', v_company.slug,
    'name', v_company.name
  );
end;
$$;

grant execute on function create_company_onboarding to authenticated;
revoke execute on function create_company_onboarding from anon, public;
