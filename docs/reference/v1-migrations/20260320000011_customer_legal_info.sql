-- ============================================================================
-- Migration: customer_legal_info
-- Description: Customer-owned legal/business details (FOP or TOV). One row
--              per user. Includes RLS for self-access and company member reads.
-- Dependencies: users (004), public_profiles_and_users_rls (20260306)
-- ============================================================================

-- ############################################################################
-- PART 1: CREATE TABLE — customer_legal_info
-- ############################################################################

create table if not exists customer_legal_info (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        not null references users (id) on delete cascade unique,
  entity_type   text        not null default 'fop'
                            constraint chk_customer_legal_info_entity_type
                            check (entity_type in ('fop', 'tov')),
  legal_name    text,
  edrpou        text,
  legal_address text,
  iban          text,
  bank_name     text,
  bank_mfo      text,
  phone         text,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  customer_legal_info               is 'Customer-owned legal/business details (FOP or TOV). One row per user.';
comment on column customer_legal_info.user_id       is 'Owner — one-to-one with users';
comment on column customer_legal_info.entity_type   is 'Legal entity type: fop (sole proprietor) or tov (LLC)';
comment on column customer_legal_info.legal_name    is 'Official legal name, e.g. "ФОП Іванов І.І."';
comment on column customer_legal_info.edrpou        is 'ЄДРПОУ or ІПН tax identifier (8-10 digits)';
comment on column customer_legal_info.legal_address is 'Legal/registration address';
comment on column customer_legal_info.iban          is 'Bank account IBAN';
comment on column customer_legal_info.bank_name     is 'Bank name';
comment on column customer_legal_info.bank_mfo      is 'Bank MFO routing code (6 digits)';

-- ############################################################################
-- PART 2: ROW-LEVEL SECURITY
-- ############################################################################

alter table customer_legal_info enable row level security;
alter table customer_legal_info force row level security;

create policy "customer_legal_info: select own"
  on customer_legal_info for select to authenticated
  using (user_id = (select auth.uid()));

create policy "customer_legal_info: insert own"
  on customer_legal_info for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "customer_legal_info: update own"
  on customer_legal_info for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "customer_legal_info: delete own"
  on customer_legal_info for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "customer_legal_info: company member reads customer"
  on customer_legal_info for select to authenticated
  using ((select is_customer_of_company_member(user_id)));

-- ############################################################################
-- PART 3: TRIGGER — updated_at
-- ############################################################################

create trigger customer_legal_info_update_timestamp
  before update on customer_legal_info
  for each row
  execute function update_timestamp();
