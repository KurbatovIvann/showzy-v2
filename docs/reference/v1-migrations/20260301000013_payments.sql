-- ============================================================================
-- Migration: payments
-- Description: Payment settings (with bank details from day one), payment
--              transactions, checkout sessions (with delivery JSONB), and
--              user checkout preferences.
-- Dependencies: companies, orders, carts, auth.users, company_members
--               (is_company_member), core_functions (update_timestamp)
-- Sources: 027_payments (DDL + RLS + checkout_sessions + upsert RPC),
--          045_bank_transfer_fields (bank columns merged into DDL),
--          069_user_checkout_preferences,
--          070_checkout_sessions_delivery_jsonb (delivery_method + delivery_info
--          columns merged into DDL, final upsert_checkout_session)
-- ============================================================================

-- ############################################################################
-- PART 1: PAYMENT SETTINGS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: payment_settings
-- Merged from 027 + 045. Includes bank_recipient_tax_id, bank_mfo, bank_edrpou
-- from day one (were ALTER TABLE additions in 045).
-- ----------------------------------------------------------------------------

create table if not exists payment_settings (
	id                      uuid        default gen_random_uuid() primary key,
	company_id              uuid        references companies (id) on delete cascade unique,
	liqpay_sandbox          boolean     default true,
	enabled_methods         text[]      default '{}',
	bank_name               text,
	bank_iban               text,
	bank_recipient          text,
	bank_recipient_tax_id   text,
	bank_mfo                text,
	bank_edrpou             text,
	bank_notes              text,
	bank_reference_template text        default '#{order_number}',
	created_at              timestamptz default now(),
	updated_at              timestamptz default now()
);

comment on table  payment_settings                          is 'Payment configuration for each company';
comment on column payment_settings.liqpay_sandbox           is 'LiqPay sandbox mode for testing (credentials managed via integrations)';
comment on column payment_settings.enabled_methods          is 'Array of enabled payment methods: apple_pay, google_pay, bank_transfer, cash_on_delivery';
comment on column payment_settings.bank_reference_template  is 'Template for payment reference tag shown to customers. Supports placeholders: {order_number}, {amount}, {customer_name}';
comment on column payment_settings.bank_recipient_tax_id    is 'Recipient ІПН/ЄДРПОУ (8-10 digits)';
comment on column payment_settings.bank_mfo                 is 'Bank МФО routing code (6 digits)';
comment on column payment_settings.bank_edrpou              is 'Bank ЄДРПОУ code (8 digits)';

-- ----------------------------------------------------------------------------
-- RLS (payment_settings) — upgraded to is_company_member
-- No additional indexes: company_id UNIQUE constraint creates an index.
-- ----------------------------------------------------------------------------

alter table payment_settings enable row level security;
alter table payment_settings force row level security;

create policy "payment_settings: member select"
	on payment_settings
	for select
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

create policy "payment_settings: member insert"
	on payment_settings
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

create policy "payment_settings: member update"
	on payment_settings
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

create policy "payment_settings: member delete"
	on payment_settings
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (payment_settings)
-- ----------------------------------------------------------------------------

create trigger payment_settings_update_timestamp
	before update on payment_settings
	for each row
	execute function update_timestamp();

-- ----------------------------------------------------------------------------
-- Function: get_checkout_payment_info
-- SECURITY DEFINER RPC. Returns only checkout-relevant columns from
-- payment_settings, hiding internal fields (liqpay_sandbox). Callable by
-- any authenticated user — replaces the old permissive SELECT policy.
-- ----------------------------------------------------------------------------

create or replace function get_checkout_payment_info(p_company_id uuid)
returns table (
	enabled_methods text[],
	bank_name text,
	bank_iban text,
	bank_recipient text,
	bank_recipient_tax_id text,
	bank_mfo text,
	bank_edrpou text,
	bank_notes text,
	bank_reference_template text
)
security definer
stable
language sql
set search_path = ''
as $$
	select
		ps.enabled_methods,
		ps.bank_name,
		ps.bank_iban,
		ps.bank_recipient,
		ps.bank_recipient_tax_id,
		ps.bank_mfo,
		ps.bank_edrpou,
		ps.bank_notes,
		ps.bank_reference_template
	from public.payment_settings ps
	where ps.company_id = p_company_id;
$$;

comment on function get_checkout_payment_info(uuid) is
	'Returns checkout-relevant payment settings for a company (hides internal fields like liqpay_sandbox)';

grant execute on function get_checkout_payment_info(uuid) to authenticated;

-- ############################################################################
-- PART 2: PAYMENTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: payments
-- From 027. Improvement: added updated_at column for consistency with every
-- other core table.
-- ----------------------------------------------------------------------------

create table if not exists payments (
	id                  uuid           default gen_random_uuid() primary key,
	company_id          uuid           not null references companies (id) on delete cascade,
	order_id            uuid           references orders (id) on delete set null,
	method              text           not null
		check (method in ('card', 'apple_pay', 'google_pay', 'bank_transfer', 'cash_on_delivery')),
	status              text           not null default 'pending'
		check (status in ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
	amount              numeric(10, 2) not null,
	currency            text           default 'UAH',
	reference_tag       text           unique,
	liqpay_order_id     text,
	liqpay_payment_id   text,
	liqpay_status       text,
	bank_provider       text,
	bank_transaction_id text,
	bank_matched_at     timestamptz,
	metadata            jsonb,
	error_message       text,
	created_at          timestamptz    default now(),
	updated_at          timestamptz    default now(),
	completed_at        timestamptz
);

comment on table  payments                    is 'Payment transactions for orders';
comment on column payments.reference_tag      is 'Unique reference tag for bank reconciliation (e.g., #EXA-2025-0017)';
comment on column payments.bank_provider      is 'Bank provider for future integration: monobank, privatbank';
comment on column payments.bank_matched_at    is 'Timestamp when payment was auto-matched by bank integration';

-- ----------------------------------------------------------------------------
-- Indexes (payments) — 4 kept, 1 removed as redundant
-- Removed: idx_payments_company_id — covered by idx_payments_company_status
--          composite prefix (company_id, status).
-- ----------------------------------------------------------------------------

create index idx_payments_order_id on payments (order_id);
create index idx_payments_company_status on payments (company_id, status);
create index idx_payments_bank_provider on payments (bank_provider) where bank_provider is not null;
create index idx_payments_created_at on payments (created_at desc);

-- ----------------------------------------------------------------------------
-- RLS (payments) — upgraded to is_company_member, INSERT security hole fixed
-- Security fix: removed the original "payments: authenticated insert" which
-- allowed ANY logged-in user to insert payments for ANY company. Checkout
-- payments are created by create_order_secure() (SECURITY DEFINER, bypasses
-- RLS), so no broad INSERT policy is needed.
-- No DELETE policy — payment records should not be deleted.
-- ----------------------------------------------------------------------------

alter table payments enable row level security;
alter table payments force row level security;

create policy "payments: select"
	on payments
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'orders:view', (select auth.uid()))
		or exists (
			select 1 from orders o
			join company_customers cc on cc.id = o.customer_id
			where o.id = payments.order_id
			  and cc.user_id = (select auth.uid())
		)
	);

create policy "payments: member insert"
	on payments
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

create policy "payments: member update"
	on payments
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (payments)
-- ----------------------------------------------------------------------------

create trigger payments_update_timestamp
	before update on payments
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: CHECKOUT SESSIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: checkout_sessions
-- Merged from 027 + 070. Includes delivery_method and delivery_info JSONB
-- from day one. The flat delivery columns (delivery_address, delivery_city,
-- delivery_postal_code) were dropped in 070 and are NOT included.
-- ----------------------------------------------------------------------------

create table if not exists checkout_sessions (
	id                 uuid        default gen_random_uuid() primary key,
	company_id         uuid        not null references companies (id) on delete cascade,
	cart_id            uuid        not null references carts (id) on delete cascade,
	user_id            uuid        references auth.users (id) on delete cascade,
	customer_name      text,
	customer_email     text,
	customer_phone     text,
	delivery_method    text,
	delivery_info      jsonb,
	payment_method     text
		check (payment_method is null or payment_method in (
			'card', 'apple_pay', 'google_pay', 'bank_transfer', 'cash_on_delivery')),
	notes              text,
	status             text        not null default 'active'
		check (status in ('active', 'completed', 'abandoned')),
	completed_order_id uuid        references orders (id) on delete set null,
	created_at         timestamptz default now(),
	updated_at         timestamptz default now(),
	expires_at         timestamptz default (now() + interval '24 hours')
);

comment on table  checkout_sessions                 is 'Persists checkout form data for session recovery';
comment on column checkout_sessions.status          is 'Session state: active (in progress), completed (order placed), abandoned (expired/unused)';
comment on column checkout_sessions.expires_at      is 'Sessions expire after 24 hours of inactivity';
comment on column checkout_sessions.delivery_method is 'Selected delivery method for this session (nova_poshta, pickup, city_delivery)';
comment on column checkout_sessions.delivery_info   is 'Full delivery details as JSONB (city, warehouse, address, etc.)';

-- ----------------------------------------------------------------------------
-- Indexes (checkout_sessions) — 5 from 027, unchanged
-- ----------------------------------------------------------------------------

create index idx_checkout_sessions_cart_id on checkout_sessions (cart_id);
create index idx_checkout_sessions_user_id on checkout_sessions (user_id);
create index idx_checkout_sessions_status on checkout_sessions (status) where status = 'active';
create index idx_checkout_sessions_expires_at on checkout_sessions (expires_at) where status = 'active';

create unique index idx_checkout_sessions_active_cart
	on checkout_sessions (cart_id)
	where status = 'active';

-- ----------------------------------------------------------------------------
-- RLS (checkout_sessions) — from 027, unchanged (user-scoped)
-- ----------------------------------------------------------------------------

alter table checkout_sessions enable row level security;
alter table checkout_sessions force row level security;

create policy "checkout_sessions: user select own"
	on checkout_sessions
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "checkout_sessions: user insert"
	on checkout_sessions
	for insert
	to authenticated
	with check (user_id = (select auth.uid()));

create policy "checkout_sessions: user update own"
	on checkout_sessions
	for update
	to authenticated
	using (user_id = (select auth.uid()) and status = 'active')
	with check (user_id = (select auth.uid()) and status in ('active', 'abandoned'));

-- ----------------------------------------------------------------------------
-- Trigger (checkout_sessions)
-- ----------------------------------------------------------------------------

create trigger checkout_sessions_update_timestamp
	before update on checkout_sessions
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 4: USER CHECKOUT PREFERENCES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: user_checkout_preferences (from 069)
-- Replaces the dropped user_delivery_preferences. Uses JSONB for extensibility.
-- ----------------------------------------------------------------------------

create table user_checkout_preferences (
	user_id    uuid        primary key references auth.users (id) on delete cascade,
	delivery   jsonb       not null default '{}',
	payment    jsonb       not null default '{}',
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);

comment on table  user_checkout_preferences          is 'User checkout preferences for prefill (delivery + payment). JSONB for extensibility.';
comment on column user_checkout_preferences.user_id  is 'References auth.users — one row per user';
comment on column user_checkout_preferences.delivery is 'Last-used delivery info: { method, sub_type, city_ref, city_name, warehouse_ref, ... }';
comment on column user_checkout_preferences.payment  is 'Payment preferences: { method } — extensible for future fields';

-- ----------------------------------------------------------------------------
-- RLS (user_checkout_preferences) — from 069 (user self-CRUD)
-- ----------------------------------------------------------------------------

alter table user_checkout_preferences enable row level security;
alter table user_checkout_preferences force row level security;

create policy "user_checkout_preferences: user select"
	on user_checkout_preferences
	for select
	using (user_id = (select auth.uid()));

create policy "user_checkout_preferences: user insert"
	on user_checkout_preferences
	for insert
	with check (user_id = (select auth.uid()));

create policy "user_checkout_preferences: user update"
	on user_checkout_preferences
	for update
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "user_checkout_preferences: user delete"
	on user_checkout_preferences
	for delete
	using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Trigger (user_checkout_preferences)
-- ----------------------------------------------------------------------------

create trigger user_checkout_preferences_update_timestamp
	before update on user_checkout_preferences
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 5: FUNCTION — upsert_checkout_session
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: upsert_checkout_session (final version from 070)
-- SECURITY DEFINER RPC. Creates or updates checkout session with delivery +
-- payment data, extending expiry on each update.
-- 9 params including p_delivery_method and p_delivery_info.
-- ----------------------------------------------------------------------------

create or replace function upsert_checkout_session(
	p_company_id uuid,
	p_cart_id uuid,
	p_customer_name text default null,
	p_customer_email text default null,
	p_customer_phone text default null,
	p_payment_method text default null,
	p_notes text default null,
	p_delivery_method text default null,
	p_delivery_info jsonb default null
)
returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_session_id uuid;
	v_user_id uuid;
begin
	v_user_id := auth.uid();

	if v_user_id is null then
		raise exception 'User must be authenticated';
	end if;

	select id into v_session_id
	from public.checkout_sessions
	where cart_id = p_cart_id and status = 'active';

	if v_session_id is not null then
		update public.checkout_sessions
		set
			customer_name = coalesce(p_customer_name, customer_name),
			customer_email = coalesce(p_customer_email, customer_email),
			customer_phone = coalesce(p_customer_phone, customer_phone),
			payment_method = coalesce(p_payment_method, payment_method),
			notes = coalesce(p_notes, notes),
			delivery_method = coalesce(p_delivery_method, delivery_method),
			delivery_info = coalesce(p_delivery_info, delivery_info),
			updated_at = now(),
			expires_at = now() + interval '24 hours'
		where id = v_session_id;
	else
		insert into public.checkout_sessions (
			company_id,
			cart_id,
			user_id,
			customer_name,
			customer_email,
			customer_phone,
			payment_method,
			notes,
			delivery_method,
			delivery_info
		) values (
			p_company_id,
			p_cart_id,
			v_user_id,
			p_customer_name,
			p_customer_email,
			p_customer_phone,
			p_payment_method,
			p_notes,
			p_delivery_method,
			p_delivery_info
		)
		returning id into v_session_id;
	end if;

	return v_session_id;
end;
$$;

comment on function upsert_checkout_session is
	'Creates or updates checkout session with delivery + payment data, extending expiry on each update';

grant execute on function upsert_checkout_session(uuid, uuid, text, text, text, text, text, text, jsonb) to authenticated;

-- ############################################################################
-- REALTIME CONFIGURATION (from 047)
-- ############################################################################

alter publication supabase_realtime add table payments;
