-- ============================================================================
-- Migration: integrations
-- Description: Company integrations system with secure vault-based token
--              storage, bank transaction import/matching, and LiqPay
--              credentials retrieval. Supports banks, delivery, acquiring,
--              and messaging integration categories with webhook dispatch.
-- Dependencies: companies, orders, payments, carts, company_members
--               (is_company_member), core_functions (update_timestamp), vault
-- Sources: 036_integrations (DDL, functions, RLS),
--          057_messaging_channels (messaging category for company_integrations),
--          058_service_role_secret_access (superseded by 065),
--          062_permissions_enforcement (RLS owner->member, function rewrites
--          with p_user_id),
--          063_webhook_id_column (webhook_id column + unique index),
--          064_monobank_sync_columns (sync tracking columns),
--          065_fix_service_role_secret_access (final vault functions with
--          service role bypass)
-- ============================================================================

-- ############################################################################
-- PART 1: TABLES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: company_integrations
-- Merged from 036 + 057 (messaging category) + 063 (webhook_id) + 064
-- (sync columns). All columns from day one.
-- ----------------------------------------------------------------------------

create table if not exists company_integrations (
	id              uuid        default gen_random_uuid() primary key,
	company_id      uuid        not null references companies (id) on delete cascade,
	provider        text        not null,
	category        text        not null default 'banks'
		check (category in ('banks', 'delivery', 'acquiring', 'messaging')),
	display_name    text,
	config          jsonb       default '{}'::jsonb,
	webhook_id      text,
	is_active       boolean     default false,
	status          text        not null default 'pending'
		check (status in ('pending', 'connected', 'error', 'disconnected')),
	last_synced_at  timestamptz,
	last_error      text,
	sync_status     text        default 'idle'
		check (sync_status in ('idle', 'pending', 'syncing', 'error')),
	sync_cursor     jsonb       default '{}'::jsonb,
	last_api_call_at timestamptz,
	next_sync_at    timestamptz,
	created_at      timestamptz default now(),
	updated_at      timestamptz default now(),

	unique (company_id, provider)
);

comment on table company_integrations is 'Unified table for all company integrations (banks, shipping, acquiring, messaging)';
comment on column company_integrations.provider is 'Integration provider: monobank, privatbank, nova_poshta, liqpay, etc.';
comment on column company_integrations.category is 'Integration category: banks, delivery, acquiring, messaging';
comment on column company_integrations.config is 'Provider-specific configuration (JSONB)';
comment on column company_integrations.webhook_id is 'Unique webhook identifier for direct lookup on incoming webhooks';
comment on column company_integrations.status is 'Integration status: pending, connected, error, disconnected';
comment on column company_integrations.sync_status is 'Sync lifecycle: idle, pending (queued), syncing (in progress), error';
comment on column company_integrations.sync_cursor is 'Tracks which accounts remain to sync in the current run: { pending_accounts, completed_accounts, sync_from }';
comment on column company_integrations.last_api_call_at is 'When we last called the provider API for this integration (rate limit tracking)';
comment on column company_integrations.next_sync_at is 'When this integration should be synced next (configurable interval)';

-- ----------------------------------------------------------------------------
-- Table: integration_secrets
-- Encrypted secrets storage for integrations (references vault.secrets).
-- No direct RLS policies — all access goes through SECURITY DEFINER vault
-- functions.
-- ----------------------------------------------------------------------------

create table if not exists integration_secrets (
	id              uuid        default gen_random_uuid() primary key,
	integration_id  uuid        not null references company_integrations (id) on delete cascade,
	secret_name     text        not null,
	secret_id       uuid        not null,
	created_at      timestamptz default now(),
	updated_at      timestamptz default now(),

	unique (integration_id, secret_name)
);

comment on table integration_secrets is 'Encrypted secrets for integrations (vault references)';
comment on column integration_secrets.secret_name is 'Secret identifier: api_token, private_key, webhook_secret, etc.';
comment on column integration_secrets.secret_id is 'Reference to vault.secrets for encrypted value';

-- ----------------------------------------------------------------------------
-- Table: bank_transactions
-- Generic table for bank transactions from any provider.
-- ----------------------------------------------------------------------------

create table if not exists bank_transactions (
	id                  uuid           default gen_random_uuid() primary key,
	company_id          uuid           not null references companies (id) on delete cascade,
	integration_id      uuid           not null references company_integrations (id) on delete cascade,
	external_id         text           not null,
	account_iban        text,
	amount              numeric(12, 2) not null,
	currency_code       integer        default 980,
	description         text,
	comment             text,
	counterparty_name   text,
	counterparty_iban   text,
	counterparty_edrpou text,
	transaction_time    timestamptz    not null,
	mcc                 integer,
	matched_order_id    uuid           references orders (id) on delete set null,
	matched_payment_id  uuid           references payments (id) on delete set null,
	match_type          text           check (match_type is null or match_type in ('auto', 'manual')),
	is_income           boolean        generated always as (amount > 0) stored,
	raw_data            jsonb,
	created_at          timestamptz    default now(),

	unique (company_id, integration_id, external_id)
);

comment on table bank_transactions is 'Bank transactions from integrated providers';
comment on column bank_transactions.external_id is 'Transaction ID from the bank provider';
comment on column bank_transactions.currency_code is 'ISO 4217 currency code (980 = UAH)';
comment on column bank_transactions.match_type is 'How the transaction was matched: auto (by reference) or manual';
comment on column bank_transactions.is_income is 'Generated column: true if amount > 0';

-- ############################################################################
-- PART 2: INDEXES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Indexes (company_integrations) — 5 kept, 1 removed as redundant
-- Removed: idx_company_integrations_company_id — covered by unique constraint
--          (company_id, provider) prefix.
-- ----------------------------------------------------------------------------

create index idx_company_integrations_provider on company_integrations (provider);
create index idx_company_integrations_category on company_integrations (category);
create index idx_company_integrations_status on company_integrations (status) where is_active = true;
create index idx_company_integrations_config on company_integrations using gin (config);

create unique index idx_company_integrations_webhook_id
	on company_integrations (webhook_id)
	where webhook_id is not null;

create index idx_company_integrations_sync_pending
	on company_integrations (sync_status)
	where sync_status in ('pending', 'syncing');

-- ----------------------------------------------------------------------------
-- Indexes (integration_secrets) — 0 kept, 1 removed as redundant
-- Removed: idx_integration_secrets_integration_id — covered by unique
--          constraint (integration_id, secret_name) prefix.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Indexes (bank_transactions) — 6 kept, all useful
-- ----------------------------------------------------------------------------

create index idx_bank_transactions_company_id on bank_transactions (company_id);
create index idx_bank_transactions_integration_id on bank_transactions (integration_id);
create index idx_bank_transactions_matched_order_id on bank_transactions (matched_order_id)
	where matched_order_id is not null;
create index idx_bank_transactions_transaction_time on bank_transactions (transaction_time desc);
create index idx_bank_transactions_is_income on bank_transactions (is_income)
	where is_income = true;
create index idx_bank_transactions_unmatched on bank_transactions (company_id, transaction_time desc)
	where matched_order_id is null and is_income = true;

-- ############################################################################
-- PART 3: ROW LEVEL SECURITY
-- ############################################################################

alter table company_integrations enable row level security;
alter table company_integrations force row level security;
alter table integration_secrets enable row level security;
alter table integration_secrets force row level security;
alter table bank_transactions enable row level security;
alter table bank_transactions force row level security;

-- ----------------------------------------------------------------------------
-- RLS (company_integrations) — from 062, member CRUD
-- ----------------------------------------------------------------------------

create policy "company_integrations: member select"
	on company_integrations
	for select
	to authenticated
	using (has_company_permission(company_id, 'integrations:view', (select auth.uid())));

create policy "company_integrations: member insert"
	on company_integrations
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'integrations:manage', (select auth.uid())));

create policy "company_integrations: member update"
	on company_integrations
	for update
	to authenticated
	using (has_company_permission(company_id, 'integrations:manage', (select auth.uid())))
	with check (has_company_permission(company_id, 'integrations:manage', (select auth.uid())));

create policy "company_integrations: member delete"
	on company_integrations
	for delete
	to authenticated
	using (has_company_permission(company_id, 'integrations:manage', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- RLS (integration_secrets) — no direct policies
-- All secret access goes through SECURITY DEFINER vault functions.
-- RLS enabled with no policies = blocks all direct access except via
-- SECURITY DEFINER functions and service_role.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- RLS (bank_transactions) — from 062, member CRUD
-- ----------------------------------------------------------------------------

create policy "bank_transactions: member select"
	on bank_transactions
	for select
	to authenticated
	using (has_company_permission(company_id, 'transactions:view', (select auth.uid())));

create policy "bank_transactions: member insert"
	on bank_transactions
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'transactions:link', (select auth.uid())));

create policy "bank_transactions: member update"
	on bank_transactions
	for update
	to authenticated
	using (has_company_permission(company_id, 'transactions:link', (select auth.uid())))
	with check (has_company_permission(company_id, 'transactions:link', (select auth.uid())));

create policy "bank_transactions: member delete"
	on bank_transactions
	for delete
	to authenticated
	using (has_company_permission(company_id, 'transactions:link', (select auth.uid())));

-- ############################################################################
-- PART 4: TRIGGERS
-- ############################################################################

create trigger company_integrations_update_timestamp
	before update on company_integrations
	for each row
	execute function update_timestamp();

create trigger integration_secrets_update_timestamp
	before update on integration_secrets
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 5: VAULT FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: store_integration_secret (final version from 065)
-- SECURITY DEFINER. Stores an integration secret in vault. Service role
-- bypasses permission check; authenticated users require company membership.
-- Improvement: search_path fixed from 'public', 'vault' to '' with qualified
-- table/function names.
-- ----------------------------------------------------------------------------

create or replace function store_integration_secret(
	p_integration_id uuid,
	p_secret_name text,
	p_secret_value text,
	p_user_id uuid default auth.uid()
) returns uuid
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_company_id uuid;
	v_secret_id uuid;
	v_vault_name text;
	v_vault_description text;
	v_existing_secret_id uuid;
	v_is_service_role boolean;
begin
	v_is_service_role := coalesce(
		current_setting('request.jwt.claims', true)::json->>'role',
		''
	) = 'service_role';

	select company_id into v_company_id
	from public.company_integrations
	where id = p_integration_id;

	if v_company_id is null then
		raise exception 'Integration not found';
	end if;

	if not v_is_service_role and not public.is_company_member(v_company_id, p_user_id) then
		raise exception 'Access denied: not a company member';
	end if;

	v_vault_name := 'integration_' || p_integration_id::text || '_' || p_secret_name;
	v_vault_description := 'Integration secret: ' || p_secret_name || ' for integration ' || p_integration_id::text;

	select secret_id into v_existing_secret_id
	from public.integration_secrets
	where integration_id = p_integration_id and secret_name = p_secret_name;

	if v_existing_secret_id is not null then
		perform vault.update_secret(v_existing_secret_id, p_secret_value, v_vault_name, v_vault_description);
		v_secret_id := v_existing_secret_id;
	else
		select id into v_secret_id
		from vault.decrypted_secrets
		where name = v_vault_name;

		if v_secret_id is not null then
			perform vault.update_secret(v_secret_id, p_secret_value, v_vault_name, v_vault_description);
		else
			v_secret_id := vault.create_secret(p_secret_value, v_vault_name, v_vault_description);
		end if;

		insert into public.integration_secrets (integration_id, secret_name, secret_id)
		values (p_integration_id, p_secret_name, v_secret_id)
		on conflict (integration_id, secret_name) do update
		set secret_id = v_secret_id, updated_at = now();
	end if;

	return v_secret_id;
end;
$$;

comment on function store_integration_secret(uuid, text, text, uuid) is
	'Stores an integration secret securely in vault. Service role bypasses permission check; authenticated users require company membership.';

-- ----------------------------------------------------------------------------
-- Function: get_integration_secret (final version from 065)
-- SECURITY DEFINER. Retrieves an integration secret from vault. Service role
-- bypasses permission check; authenticated users require company membership.
-- Improvement: search_path fixed from 'public', 'vault' to '' with qualified
-- table/function names.
-- ----------------------------------------------------------------------------

create or replace function get_integration_secret(
	p_integration_id uuid,
	p_secret_name text,
	p_user_id uuid default auth.uid()
) returns text
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_company_id uuid;
	v_secret_id uuid;
	v_secret text;
	v_is_service_role boolean;
begin
	v_is_service_role := coalesce(
		current_setting('request.jwt.claims', true)::json->>'role',
		''
	) = 'service_role';

	select company_id into v_company_id
	from public.company_integrations
	where id = p_integration_id;

	if v_company_id is null then
		raise exception 'Integration not found';
	end if;

	if not v_is_service_role and not public.is_company_member(v_company_id, p_user_id) then
		raise exception 'Access denied: not a company member';
	end if;

	select secret_id into v_secret_id
	from public.integration_secrets
	where integration_id = p_integration_id and secret_name = p_secret_name;

	if v_secret_id is null then
		return null;
	end if;

	select decrypted_secret into v_secret
	from vault.decrypted_secrets
	where id = v_secret_id;

	return v_secret;
end;
$$;

comment on function get_integration_secret(uuid, text, uuid) is
	'Retrieves an integration secret from vault. Service role bypasses permission check; authenticated users require company membership.';

-- ----------------------------------------------------------------------------
-- Function: delete_integration_secrets (final version from 065)
-- SECURITY DEFINER. Deletes all secret references for an integration. The
-- vault secrets become orphaned but are no longer accessible. Service role
-- bypasses permission check; authenticated users require company membership.
-- Improvement: search_path fixed from 'public', 'vault' to '' with qualified
-- table names.
-- ----------------------------------------------------------------------------

create or replace function delete_integration_secrets(
	p_integration_id uuid,
	p_user_id uuid default auth.uid()
) returns void
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_company_id uuid;
	v_is_service_role boolean;
begin
	v_is_service_role := coalesce(
		current_setting('request.jwt.claims', true)::json->>'role',
		''
	) = 'service_role';

	select company_id into v_company_id
	from public.company_integrations
	where id = p_integration_id;

	if v_company_id is null then
		raise exception 'Integration not found';
	end if;

	if not v_is_service_role and not public.is_company_member(v_company_id, p_user_id) then
		raise exception 'Access denied: not a company member';
	end if;

	delete from public.integration_secrets where integration_id = p_integration_id;
end;
$$;

comment on function delete_integration_secrets(uuid, uuid) is
	'Deletes all secrets for an integration from vault. Service role bypasses permission check; authenticated users require company membership.';

-- ############################################################################
-- PART 6: OTHER FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: get_liqpay_credentials (from 036)
-- SECURITY DEFINER. Retrieves LiqPay public/private key pair for checkout.
-- Accessible by company members AND customers with active carts.
-- Improvement: upgraded from is_company_owner to is_company_member for
-- consistency. search_path fixed from 'public', 'vault' to '' with qualified
-- table/view names.
-- ----------------------------------------------------------------------------

create or replace function get_liqpay_credentials(p_company_id uuid)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_integration record;
	v_secret_id uuid;
	v_private_key text;
	v_has_cart boolean;
begin
	if not public.is_company_member(p_company_id, (select auth.uid())) then
		select exists(
			select 1 from public.carts
			where user_id = auth.uid()
			  and company_id = p_company_id
		) into v_has_cart;

		if not v_has_cart then
			raise exception 'Access denied: not authorized to access payment credentials';
		end if;
	end if;

	select id, config into v_integration
	from public.company_integrations
	where company_id = p_company_id
	  and provider = 'liqpay'
	  and status = 'connected'
	  and is_active = true;

	if v_integration.id is null then
		return null;
	end if;

	select secret_id into v_secret_id
	from public.integration_secrets
	where integration_id = v_integration.id
	  and secret_name = 'private_key';

	if v_secret_id is null then
		return null;
	end if;

	select decrypted_secret into v_private_key
	from vault.decrypted_secrets
	where id = v_secret_id;

	return jsonb_build_object(
		'public_key', v_integration.config->>'public_key',
		'private_key', v_private_key
	);
end;
$$;

comment on function get_liqpay_credentials(uuid) is
	'Retrieves LiqPay credentials from integration. Accessible by company members and customers with active carts.';

-- ----------------------------------------------------------------------------
-- Function: match_bank_transaction_to_order (from 062)
-- SECURITY DEFINER. Matches a bank transaction to an order and creates or
-- updates the corresponding payment record.
-- Improvement: replaced has_company_permission with is_company_member.
-- search_path fixed from 'public' to '' with qualified table names.
-- ----------------------------------------------------------------------------

create or replace function match_bank_transaction_to_order(
	p_transaction_id uuid,
	p_order_id uuid,
	p_match_type text default 'manual',
	p_user_id uuid default auth.uid()
) returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_transaction record;
	v_order record;
	v_payment_id uuid;
begin
	select bt.*, ci.company_id as integration_company_id
	into v_transaction
	from public.bank_transactions bt
	join public.company_integrations ci on ci.id = bt.integration_id
	where bt.id = p_transaction_id;

	if v_transaction is null then
		raise exception 'Transaction not found';
	end if;

	if not public.is_company_member(v_transaction.company_id, p_user_id) then
		raise exception 'Access denied: not a company member';
	end if;

	select * into v_order
	from public.orders
	where id = p_order_id and company_id = v_transaction.company_id;

	if v_order is null then
		raise exception 'Order not found or belongs to different company';
	end if;

	select id into v_payment_id
	from public.payments
	where order_id = p_order_id
	limit 1;

	if v_payment_id is null then
		insert into public.payments (
			company_id,
			order_id,
			method,
			status,
			amount,
			currency,
			bank_provider,
			bank_transaction_id,
			bank_matched_at
		) values (
			v_transaction.company_id,
			p_order_id,
			'bank_transfer',
			'completed',
			v_transaction.amount,
			case v_transaction.currency_code
				when 980 then 'UAH'
				when 840 then 'USD'
				when 978 then 'EUR'
				else 'UAH'
			end,
			'monobank',
			v_transaction.external_id,
			now()
		)
		returning id into v_payment_id;
	else
		update public.payments
		set status = 'completed',
		    bank_provider = 'monobank',
		    bank_transaction_id = v_transaction.external_id,
		    bank_matched_at = now(),
		    completed_at = now()
		where id = v_payment_id;
	end if;

	update public.bank_transactions
	set matched_order_id = p_order_id,
	    matched_payment_id = v_payment_id,
	    match_type = p_match_type
	where id = p_transaction_id;

	update public.orders
	set payment_status = 'paid'
	where id = p_order_id and payment_status != 'paid';

	return jsonb_build_object(
		'success', true,
		'transaction_id', p_transaction_id,
		'order_id', p_order_id,
		'payment_id', v_payment_id,
		'match_type', p_match_type
	);
end;
$$;

comment on function match_bank_transaction_to_order(uuid, uuid, text, uuid) is
	'Matches a bank transaction to an order and updates payment status. Requires company membership.';

-- ----------------------------------------------------------------------------
-- Function: unlink_bank_transaction (from 062)
-- SECURITY DEFINER. Removes the match between a bank transaction and an order.
-- Does not revert the order payment status (may have other payments).
-- Improvement: replaced has_company_permission with is_company_member.
-- search_path fixed from 'public' to '' with qualified table names.
-- ----------------------------------------------------------------------------

create or replace function unlink_bank_transaction(
	p_transaction_id uuid,
	p_user_id uuid default auth.uid()
) returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_transaction record;
	v_order_id uuid;
begin
	select * into v_transaction
	from public.bank_transactions
	where id = p_transaction_id;

	if v_transaction is null then
		raise exception 'Transaction not found';
	end if;

	if not public.is_company_member(v_transaction.company_id, p_user_id) then
		raise exception 'Access denied: not a company member';
	end if;

	v_order_id := v_transaction.matched_order_id;

	update public.bank_transactions
	set matched_order_id = null,
	    matched_payment_id = null,
	    match_type = null
	where id = p_transaction_id;

	return jsonb_build_object(
		'success', true,
		'transaction_id', p_transaction_id,
		'previous_order_id', v_order_id
	);
end;
$$;

comment on function unlink_bank_transaction(uuid, uuid) is
	'Unlinks a bank transaction from its matched order. Requires company membership.';

-- ############################################################################
-- PART 7: GRANTS
-- ############################################################################

grant execute on function store_integration_secret(uuid, text, text, uuid) to authenticated;
grant execute on function store_integration_secret(uuid, text, text, uuid) to service_role;

grant execute on function get_integration_secret(uuid, text, uuid) to authenticated;
grant execute on function get_integration_secret(uuid, text, uuid) to service_role;

grant execute on function delete_integration_secrets(uuid, uuid) to authenticated;
grant execute on function delete_integration_secrets(uuid, uuid) to service_role;

grant execute on function get_liqpay_credentials(uuid) to authenticated;

grant execute on function match_bank_transaction_to_order(uuid, uuid, text, uuid) to authenticated;

grant execute on function unlink_bank_transaction(uuid, uuid) to authenticated;
