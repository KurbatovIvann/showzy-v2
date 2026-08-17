-- ============================================================================
-- Migration: mono_acquiring
-- Description: Monobank Acquiring integration — invoice tracking table,
--              payment method extension, domain events, and vault-based
--              merchant token retrieval.
-- Dependencies: companies, orders, payments, payment_settings,
--               company_integrations, integration_secrets, vault,
--               domain_events, core_functions (update_timestamp),
--               company_members (has_company_permission, is_company_member)
-- ============================================================================

-- ############################################################################
-- PART 1: ALTER EXISTING TABLES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Alter: payments.method — add 'mono_acquiring' to allowed values
-- ----------------------------------------------------------------------------

alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
	check (method in ('card', 'apple_pay', 'google_pay', 'bank_transfer', 'cash_on_delivery', 'mono_acquiring'));

-- ----------------------------------------------------------------------------
-- Alter: payment_settings — add Monobank Acquiring columns
-- ----------------------------------------------------------------------------

alter table payment_settings add column if not exists mono_acquiring_enabled boolean default false;
alter table payment_settings add column if not exists mono_acquiring_hold_mode boolean default false;

comment on column payment_settings.mono_acquiring_enabled   is 'Whether Monobank Acquiring is enabled for this company';
comment on column payment_settings.mono_acquiring_hold_mode is 'If true, invoices use hold (two-stage) payment instead of immediate debit';

-- ############################################################################
-- PART 2: TABLE — mono_acquiring_invoices
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: mono_acquiring_invoices
-- Tracks the full lifecycle of Monobank Acquiring invoices for online payments.
-- Each invoice maps to a Monobank invoice_id and optionally links to an
-- internal order and payment record.
-- ----------------------------------------------------------------------------

create table if not exists mono_acquiring_invoices (
	id               uuid           default gen_random_uuid() primary key,
	company_id       uuid           not null references companies (id) on delete cascade,
	order_id         uuid           references orders (id) on delete set null,
	payment_id       uuid           references payments (id) on delete set null,
	integration_id   uuid           not null references company_integrations (id) on delete cascade,
	invoice_id       text           not null,
	page_url         text,
	amount           integer        not null,
	ccy              integer        default 980,
	status           text           not null default 'created'
		check (status in ('created', 'processing', 'hold', 'success', 'failure', 'reversed', 'expired')),
	payment_type     text           not null default 'debit'
		check (payment_type in ('debit', 'hold')),
	failure_reason   text,
	err_code         text,
	payment_info     jsonb,
	cancel_list      jsonb,
	destination      text,
	reference        text,
	validity_seconds integer,
	webhook_url      text,
	created_at       timestamptz    default now(),
	updated_at       timestamptz    default now(),
	expires_at       timestamptz,
	finalized_at     timestamptz
);

comment on table  mono_acquiring_invoices                      is 'Tracks Monobank Acquiring invoice lifecycle for online payments';
comment on column mono_acquiring_invoices.invoice_id           is 'Monobank invoice identifier (e.g. p2_9ZgpZVsl3)';
comment on column mono_acquiring_invoices.page_url             is 'Monobank payment page URL for customer redirect';
comment on column mono_acquiring_invoices.amount               is 'Amount in minor currency units (kopiykas for UAH)';
comment on column mono_acquiring_invoices.ccy                  is 'ISO 4217 currency code (980 = UAH)';
comment on column mono_acquiring_invoices.status               is 'Invoice status from Monobank: created, processing, hold, success, failure, reversed, expired';
comment on column mono_acquiring_invoices.payment_type         is 'Payment type: debit (immediate charge) or hold (blocked funds, finalize later)';
comment on column mono_acquiring_invoices.payment_info         is 'Payment details from Monobank (masked pan, approval code, rrn, etc.)';
comment on column mono_acquiring_invoices.cancel_list          is 'List of accepted cancellation requests';
comment on column mono_acquiring_invoices.reference            is 'Merchant-defined reference (e.g. order number)';

-- ############################################################################
-- PART 3: INDEXES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Indexes (mono_acquiring_invoices) — 6 indexes
-- invoice_id is unique (one-to-one with Monobank invoice).
-- Partial indexes on order_id and payment_id since they are nullable.
-- ----------------------------------------------------------------------------

create unique index idx_mono_acq_invoices_invoice_id on mono_acquiring_invoices (invoice_id);
create index idx_mono_acq_invoices_company_status on mono_acquiring_invoices (company_id, status);
create index idx_mono_acq_invoices_order_id on mono_acquiring_invoices (order_id) where order_id is not null;
create index idx_mono_acq_invoices_payment_id on mono_acquiring_invoices (payment_id) where payment_id is not null;
create index idx_mono_acq_invoices_integration_id on mono_acquiring_invoices (integration_id);
create index idx_mono_acq_invoices_created_at on mono_acquiring_invoices (created_at desc);

-- ############################################################################
-- PART 4: ROW LEVEL SECURITY
-- ############################################################################

alter table mono_acquiring_invoices enable row level security;
alter table mono_acquiring_invoices force row level security;

-- ----------------------------------------------------------------------------
-- RLS (mono_acquiring_invoices) — mirrors payments RLS pattern
-- SELECT: company members with orders:view OR customers who own the linked order.
-- INSERT/UPDATE: company members with settings:payments (manual operations).
-- Most inserts/updates come from service_role (backend) which bypasses RLS.
-- No DELETE policy — invoice records should not be deleted.
-- ----------------------------------------------------------------------------

create policy "mono_acquiring_invoices: select"
	on mono_acquiring_invoices
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'orders:view', (select auth.uid()))
		or exists (
			select 1 from orders o
			join company_customers cc on cc.id = o.customer_id
			where o.id = mono_acquiring_invoices.order_id
			  and cc.user_id = (select auth.uid())
		)
	);

create policy "mono_acquiring_invoices: member insert"
	on mono_acquiring_invoices
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

create policy "mono_acquiring_invoices: member update"
	on mono_acquiring_invoices
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

-- ############################################################################
-- PART 5: TRIGGERS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Trigger (mono_acquiring_invoices) — updated_at auto-update
-- ----------------------------------------------------------------------------

create trigger mono_acquiring_invoices_update_timestamp
	before update on mono_acquiring_invoices
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 6: DOMAIN EVENTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: fn_mono_acquiring_invoices_outbox
-- INSERT → acquiring_invoice_created
-- UPDATE → acquiring_invoice_status_changed (only when status changes)
-- ----------------------------------------------------------------------------

create or replace function fn_mono_acquiring_invoices_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('acquiring_invoice_created', 'mono_acquiring_invoice', new.id, new.company_id,
		        jsonb_build_object('new', row_to_json(new)));
	elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('acquiring_invoice_status_changed', 'mono_acquiring_invoice', new.id, new.company_id,
		        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));
	end if;

	perform pg_notify('domain_events', 'mono_acquiring_invoices');
	return new;
end;
$$;

create trigger trg_mono_acquiring_invoices_outbox
	after insert or update on mono_acquiring_invoices
	for each row execute function fn_mono_acquiring_invoices_outbox();

-- ############################################################################
-- PART 7: FUNCTION — get_mono_acquiring_token
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: get_mono_acquiring_token
-- SECURITY DEFINER. Retrieves the Monobank Acquiring merchant X-Token from
-- vault. Restricted to service_role only (backend use).
-- ----------------------------------------------------------------------------

create or replace function get_mono_acquiring_token(p_company_id uuid)
returns text
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_integration_id uuid;
	v_secret_id uuid;
	v_token text;
	v_is_service_role boolean;
begin
	v_is_service_role := coalesce(
		current_setting('request.jwt.claims', true)::json->>'role',
		''
	) = 'service_role';

	if not v_is_service_role then
		raise exception 'Access denied: service_role required';
	end if;

	select id into v_integration_id
	from public.company_integrations
	where company_id = p_company_id
	  and provider = 'monobank_acquiring'
	  and status = 'connected'
	  and is_active = true;

	if v_integration_id is null then
		return null;
	end if;

	select secret_id into v_secret_id
	from public.integration_secrets
	where integration_id = v_integration_id
	  and secret_name = 'merchant_token';

	if v_secret_id is null then
		return null;
	end if;

	select decrypted_secret into v_token
	from vault.decrypted_secrets
	where id = v_secret_id;

	return v_token;
end;
$$;

comment on function get_mono_acquiring_token(uuid) is
	'Retrieves Monobank Acquiring merchant token from vault. Service role only.';

grant execute on function get_mono_acquiring_token(uuid) to service_role;
