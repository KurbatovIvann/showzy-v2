-- ============================================================================
-- Migration: permissions
-- Description: Subscription plans, feature flags, and vault/integration
--              function upgrades to use fine-grained has_company_permission()
--              checks. Note: role_permission_defaults and has_company_permission()
--              are in 005500_permissions_core.sql (needed earlier by 006+).
-- Dependencies: companies, company_members (is_company_member, is_company_owner),
--               core_functions (update_timestamp), integrations (vault functions),
--               permissions_core (has_company_permission)
-- Sources: 033_permissions_system (DDL, functions, seed, trigger),
--          062_permissions_enforcement (vault function permission upgrades),
--          072_users_storage_bucket
-- ============================================================================

-- ############################################################################
-- PART 1: TABLES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: subscription_plans
-- Defines pricing tiers with features and limits.
-- From 033.
-- ----------------------------------------------------------------------------

create table if not exists subscription_plans (
	id            uuid        default gen_random_uuid() primary key,
	name          text        not null unique,
	display_name  text        not null,
	description   text,
	price_monthly numeric(10, 2),
	price_yearly  numeric(10, 2),
	features      text[]      not null default '{}',
	limits        jsonb       not null default '{}',
	sort_order    int         not null default 0,
	is_active     boolean     not null default true,
	created_at    timestamptz default now(),
	updated_at    timestamptz default now()
);

comment on table subscription_plans is 'Subscription pricing tiers with features and limits';
comment on column subscription_plans.name is 'Unique plan identifier: free, starter, pro, enterprise';
comment on column subscription_plans.features is 'Array of feature keys enabled for this plan';
comment on column subscription_plans.limits is 'Usage limits: {"max_products": 100, "max_team_members": 5, "storage_gb": 5}';

-- ----------------------------------------------------------------------------
-- Table: company_subscriptions
-- Links companies to their subscription plan.
-- From 033.
-- ----------------------------------------------------------------------------

create table if not exists company_subscriptions (
	id                       uuid        default gen_random_uuid() primary key,
	company_id               uuid        not null references companies (id) on delete cascade unique,
	plan_id                  uuid        not null references subscription_plans (id),
	status                   text        not null default 'active'
		check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
	current_period_start     timestamptz not null default now(),
	current_period_end       timestamptz not null,
	trial_ends_at            timestamptz,
	cancelled_at             timestamptz,
	external_subscription_id text,
	external_customer_id     text,
	metadata                 jsonb       default '{}',
	created_at               timestamptz default now(),
	updated_at               timestamptz default now()
);

comment on table company_subscriptions is 'Company subscription status and billing info';
comment on column company_subscriptions.status is 'Subscription state: active, trialing, past_due, cancelled, expired';
comment on column company_subscriptions.external_subscription_id is 'Reference to payment provider subscription ID';

-- ----------------------------------------------------------------------------
-- Table: feature_flags
-- Available features that can be enabled/disabled per plan.
-- From 033.
-- ----------------------------------------------------------------------------

create table if not exists feature_flags (
	id          uuid        default gen_random_uuid() primary key,
	key         text        not null unique,
	name        text        not null,
	description text,
	category    text        default 'general',
	is_active   boolean     not null default true,
	created_at  timestamptz default now(),
	updated_at  timestamptz default now()
);

comment on table feature_flags is 'Available features that can be enabled per subscription plan';
comment on column feature_flags.key is 'Unique feature identifier used in code: chat, ai_assistant, custom_domain';
comment on column feature_flags.category is 'Feature category for UI grouping: general, communication, ai, advanced';

-- ----------------------------------------------------------------------------
-- Table: company_feature_overrides
-- Per-company feature exceptions (beta testers, custom deals, grandfathered).
-- From 033.
-- ----------------------------------------------------------------------------

create table if not exists company_feature_overrides (
	id          uuid        default gen_random_uuid() primary key,
	company_id  uuid        not null references companies (id) on delete cascade,
	feature_key text        not null references feature_flags (key) on delete cascade,
	enabled     boolean     not null,
	reason      text,
	expires_at  timestamptz,
	created_at  timestamptz default now(),
	updated_at  timestamptz default now(),

	unique (company_id, feature_key)
);

comment on table company_feature_overrides is 'Per-company feature exceptions overriding plan defaults';
comment on column company_feature_overrides.reason is 'Why this override exists: beta_tester, enterprise_deal, grandfathered, promotional';
comment on column company_feature_overrides.expires_at is 'Optional expiration for temporary overrides';

-- NOTE: role_permission_defaults table moved to 005500_permissions_core.sql

-- ############################################################################
-- PART 2: INDEXES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Indexes (subscription_plans) — 1 kept, 1 removed as redundant
-- Removed: idx_subscription_plans_name — covered by UNIQUE constraint on name.
-- ----------------------------------------------------------------------------

create index idx_subscription_plans_active
	on subscription_plans (is_active) where is_active = true;

-- ----------------------------------------------------------------------------
-- Indexes (company_subscriptions) — 3 kept, 1 removed as redundant
-- Removed: idx_company_subscriptions_company — covered by UNIQUE constraint
--          on company_id.
-- ----------------------------------------------------------------------------

create index idx_company_subscriptions_plan on company_subscriptions (plan_id);
create index idx_company_subscriptions_status on company_subscriptions (status);
create index idx_company_subscriptions_period_end on company_subscriptions (current_period_end);

-- ----------------------------------------------------------------------------
-- Indexes (feature_flags) — 1 kept, 1 removed as redundant
-- Removed: idx_feature_flags_key — covered by UNIQUE constraint on key.
-- ----------------------------------------------------------------------------

create index idx_feature_flags_category on feature_flags (category);

-- ----------------------------------------------------------------------------
-- Indexes (company_feature_overrides) — 1 kept, 1 removed as redundant
-- Removed: idx_company_feature_overrides_company — covered by UNIQUE
--          (company_id, feature_key) prefix.
-- ----------------------------------------------------------------------------

create index idx_company_feature_overrides_feature on company_feature_overrides (feature_key);

-- ############################################################################
-- PART 3: FUNCTIONS
-- ############################################################################
-- NOTE: has_company_permission() moved to 005500_permissions_core.sql

-- ----------------------------------------------------------------------------
-- Function: has_feature (from 033)
-- SECURITY DEFINER. Checks if a company has access to a feature.
-- Resolution: company override > plan features > false.
-- Improvement: search_path hardened from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function has_feature(p_company_id uuid, p_feature_key text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
	select coalesce(
		(
			select enabled
			from public.company_feature_overrides
			where company_id = p_company_id
			  and feature_key = p_feature_key
			  and (expires_at is null or expires_at > now())
		),
		(
			select p_feature_key = any(sp.features)
			from public.company_subscriptions cs
			join public.subscription_plans sp on sp.id = cs.plan_id
			where cs.company_id = p_company_id
			  and cs.status in ('active', 'trialing')
		),
		false
	);
$$;

comment on function has_feature(uuid, text) is 'Check if company has access to a feature (override > plan > false)';

-- ----------------------------------------------------------------------------
-- Function: get_company_features (from 033)
-- SECURITY DEFINER. Returns array of all enabled feature keys for a company.
-- Combines plan features + override enabled, minus override disabled.
-- Improvement: search_path hardened from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function get_company_features(p_company_id uuid)
returns text[]
language sql
security definer
stable
set search_path = ''
as $$
	with plan_features as (
		select unnest(sp.features) as feature_key
		from public.company_subscriptions cs
		join public.subscription_plans sp on sp.id = cs.plan_id
		where cs.company_id = p_company_id
		  and cs.status in ('active', 'trialing')
	),
	override_enabled as (
		select feature_key
		from public.company_feature_overrides
		where company_id = p_company_id
		  and enabled = true
		  and (expires_at is null or expires_at > now())
	),
	override_disabled as (
		select feature_key
		from public.company_feature_overrides
		where company_id = p_company_id
		  and enabled = false
		  and (expires_at is null or expires_at > now())
	),
	all_enabled as (
		select feature_key from plan_features
		union
		select feature_key from override_enabled
		except
		select feature_key from override_disabled
	)
	select array_agg(distinct feature_key order by feature_key) from all_enabled;
$$;

comment on function get_company_features(uuid) is 'Get all enabled feature keys for a company';

-- ----------------------------------------------------------------------------
-- Function: get_company_subscription (from 033)
-- SECURITY DEFINER. Returns subscription info including plan name and features.
-- Improvement: search_path hardened from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function get_company_subscription(p_company_id uuid)
returns table (
	subscription_id uuid,
	plan_id uuid,
	plan_name text,
	plan_display_name text,
	status text,
	features text[],
	limits jsonb,
	current_period_end timestamptz,
	trial_ends_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
	select
		cs.id as subscription_id,
		cs.plan_id,
		sp.name as plan_name,
		sp.display_name as plan_display_name,
		cs.status,
		sp.features,
		sp.limits,
		cs.current_period_end,
		cs.trial_ends_at
	from public.company_subscriptions cs
	join public.subscription_plans sp on sp.id = cs.plan_id
	where cs.company_id = p_company_id;
$$;

comment on function get_company_subscription(uuid) is 'Get company subscription with plan details';

-- ----------------------------------------------------------------------------
-- Function: assign_free_plan_to_new_company (from 033)
-- SECURITY DEFINER trigger function. Auto-assigns free subscription plan to
-- newly created companies.
-- Improvement: search_path hardened from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function assign_free_plan_to_new_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_free_plan_id uuid;
begin
	select id into v_free_plan_id
	from public.subscription_plans where name = 'free';

	if v_free_plan_id is not null then
		insert into public.company_subscriptions (company_id, plan_id, current_period_end)
		values (new.id, v_free_plan_id, now() + interval '100 years')
		on conflict (company_id) do nothing;
	end if;

	return new;
end;
$$;

comment on function assign_free_plan_to_new_company() is 'Auto-assigns free subscription plan to newly created companies';

-- ############################################################################
-- PART 4: ROW LEVEL SECURITY
-- ############################################################################

alter table subscription_plans enable row level security;
alter table subscription_plans force row level security;
alter table company_subscriptions enable row level security;
alter table company_subscriptions force row level security;
alter table feature_flags enable row level security;
alter table feature_flags force row level security;
alter table company_feature_overrides enable row level security;
alter table company_feature_overrides force row level security;
-- NOTE: role_permission_defaults RLS enabled in 005500_permissions_core.sql

-- ----------------------------------------------------------------------------
-- RLS (subscription_plans) — public read for pricing pages
-- Writes via service_role/migrations only.
-- ----------------------------------------------------------------------------

create policy "subscription_plans: public read"
	on subscription_plans
	for select
	to authenticated, anon
	using (is_active = true);

-- ----------------------------------------------------------------------------
-- RLS (company_subscriptions) — member read, permission-gated update
-- INSERT handled by assign_free_plan_to_new_company() trigger (SECURITY
-- DEFINER) and payment webhooks (service_role). DELETE via service_role only.
-- ----------------------------------------------------------------------------

create policy "company_subscriptions: member select"
	on company_subscriptions
	for select
	to authenticated
	using (has_company_permission(company_id, 'settings:view', (select auth.uid())));

create policy "company_subscriptions: settings:payments update"
	on company_subscriptions
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:payments', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- RLS (feature_flags) — public read for feature discovery
-- Writes via service_role/migrations only.
-- ----------------------------------------------------------------------------

create policy "feature_flags: public read"
	on feature_flags
	for select
	to authenticated, anon
	using (is_active = true);

-- ----------------------------------------------------------------------------
-- RLS (company_feature_overrides) — member read, permission-gated write
-- ----------------------------------------------------------------------------

create policy "company_feature_overrides: member select"
	on company_feature_overrides
	for select
	to authenticated
	using (has_company_permission(company_id, 'settings:view', (select auth.uid())));

create policy "company_feature_overrides: settings:general insert"
	on company_feature_overrides
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:general', (select auth.uid())));

create policy "company_feature_overrides: settings:general update"
	on company_feature_overrides
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:general', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:general', (select auth.uid())));

create policy "company_feature_overrides: settings:general delete"
	on company_feature_overrides
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:general', (select auth.uid())));

-- NOTE: role_permission_defaults RLS section moved to 005500_permissions_core.sql

-- ############################################################################
-- PART 5: TRIGGERS
-- ############################################################################

create trigger subscription_plans_update_timestamp
	before update on subscription_plans
	for each row
	execute function update_timestamp();

create trigger company_subscriptions_update_timestamp
	before update on company_subscriptions
	for each row
	execute function update_timestamp();

create trigger feature_flags_update_timestamp
	before update on feature_flags
	for each row
	execute function update_timestamp();

create trigger company_feature_overrides_update_timestamp
	before update on company_feature_overrides
	for each row
	execute function update_timestamp();

create trigger companies_assign_free_plan
	after insert on companies
	for each row
	execute function assign_free_plan_to_new_company();

-- ############################################################################
-- PART 6: VAULT/INTEGRATION FUNCTION UPGRADES
-- ############################################################################
-- Re-declare 5 functions from 017_integrations via CREATE OR REPLACE to use
-- has_company_permission() instead of is_company_member(). Signatures are
-- identical so this is a clean in-place replacement.

-- ----------------------------------------------------------------------------
-- Function: store_integration_secret (upgrade from 017)
-- SECURITY DEFINER. Service role bypasses permission check; authenticated
-- users now require 'integrations:manage' permission (was is_company_member).
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

	if not v_is_service_role and not public.has_company_permission(v_company_id, 'integrations:manage', p_user_id) then
		raise exception 'Access denied: insufficient permissions for integrations:manage';
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
	'Stores an integration secret in vault. Service role bypasses; authenticated users require integrations:manage permission.';

-- ----------------------------------------------------------------------------
-- Function: get_integration_secret (upgrade from 017)
-- SECURITY DEFINER. Service role bypasses permission check; authenticated
-- users now require 'integrations:manage' permission (was is_company_member).
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

	if not v_is_service_role and not public.has_company_permission(v_company_id, 'integrations:manage', p_user_id) then
		raise exception 'Access denied: insufficient permissions for integrations:manage';
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
	'Retrieves an integration secret from vault. Service role bypasses; authenticated users require integrations:manage permission.';

-- ----------------------------------------------------------------------------
-- Function: delete_integration_secrets (upgrade from 017)
-- SECURITY DEFINER. Service role bypasses permission check; authenticated
-- users now require 'integrations:manage' permission (was is_company_member).
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

	if not v_is_service_role and not public.has_company_permission(v_company_id, 'integrations:manage', p_user_id) then
		raise exception 'Access denied: insufficient permissions for integrations:manage';
	end if;

	delete from public.integration_secrets where integration_id = p_integration_id;
end;
$$;

comment on function delete_integration_secrets(uuid, uuid) is
	'Deletes all secrets for an integration from vault. Service role bypasses; authenticated users require integrations:manage permission.';

-- ----------------------------------------------------------------------------
-- Function: match_bank_transaction_to_order (upgrade from 017)
-- SECURITY DEFINER. Matches a bank transaction to an order and creates or
-- updates the corresponding payment record. Now requires 'transactions:link'
-- permission (was is_company_member).
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

	if not public.has_company_permission(v_transaction.company_id, 'transactions:link', p_user_id) then
		raise exception 'Access denied: insufficient permissions for transactions:link';
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
	'Matches a bank transaction to an order and updates payment status. Requires transactions:link permission.';

-- ----------------------------------------------------------------------------
-- Function: unlink_bank_transaction (upgrade from 017)
-- SECURITY DEFINER. Removes the match between a bank transaction and an order.
-- Does not revert the order payment status (may have other payments).
-- Now requires 'transactions:link' permission (was is_company_member).
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

	if not public.has_company_permission(v_transaction.company_id, 'transactions:link', p_user_id) then
		raise exception 'Access denied: insufficient permissions for transactions:link';
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
	'Unlinks a bank transaction from its matched order. Requires transactions:link permission.';

-- ############################################################################
-- PART 7: SEED DATA
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Seed: Default subscription plans (4 tiers)
-- From 033.
-- ----------------------------------------------------------------------------

insert into subscription_plans (name, display_name, description, price_monthly, price_yearly, features, limits, sort_order)
values
	(
		'free',
		'Free',
		'Get started with basic features',
		0,
		0,
		array['showcase', 'orders', 'products'],
		'{"max_products": 100, "max_team_members": 1, "storage_gb": 5}'::jsonb,
		0
	),
	(
		'starter',
		'Starter',
		'Perfect for small businesses',
		249.99,
		2199.99,
		array['showcase', 'orders', 'products', 'chat', 'price_lists', 'analytics_basic'],
		'{"max_products": 500, "max_team_members": 3, "storage_gb": 10}'::jsonb,
		1
	),
	(
		'pro',
		'Pro',
		'Advanced features for growing businesses',
		499.99,
		4499.99,
		array['showcase', 'orders', 'products', 'chat', 'price_lists', 'analytics_basic', 'analytics_advanced', 'ai_assistant', 'custom_statuses', 'automations'],
		'{"max_products": 5000, "max_team_members": 15, "storage_gb": 35}'::jsonb,
		2
	),
	(
		'enterprise',
		'Enterprise',
		'Full-featured solution for large organizations',
		999.99,
		8999.99,
		array['showcase', 'orders', 'products', 'chat', 'price_lists', 'analytics_basic', 'analytics_advanced', 'ai_assistant', 'custom_statuses', 'automations', 'custom_domain', 'api_access', 'white_label', 'priority_support'],
		'{"max_products": -1, "max_team_members": -1, "storage_gb": 100}'::jsonb,
		3
	)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- Seed: Default feature flags (15 features across 5 categories)
-- From 033.
-- ----------------------------------------------------------------------------

insert into feature_flags (key, name, description, category)
values
	('showcase', 'Showcase', 'Public product showcase page', 'core'),
	('orders', 'Orders', 'Order management system', 'core'),
	('products', 'Products', 'Product catalog management', 'core'),
	('chat', 'Chat', 'Real-time customer chat', 'communication'),
	('price_lists', 'Price Lists', 'Multiple price lists for different customer groups', 'pricing'),
	('analytics_basic', 'Basic Analytics', 'Basic sales and traffic analytics', 'analytics'),
	('analytics_advanced', 'Advanced Analytics', 'Advanced analytics with custom reports', 'analytics'),
	('ai_assistant', 'AI Assistant', 'AI-powered product descriptions and chat', 'ai'),
	('custom_statuses', 'Custom Statuses', 'Custom order status workflows', 'workflow'),
	('automations', 'Automations', 'Automated status transitions and notifications', 'workflow'),
	('custom_domain', 'Custom Domain', 'Use your own domain for showcase', 'enterprise'),
	('api_access', 'API Access', 'REST API access for integrations', 'enterprise'),
	('white_label', 'White Label', 'Remove Showzy branding', 'enterprise'),
	('priority_support', 'Priority Support', '24/7 priority customer support', 'enterprise')
on conflict (key) do nothing;

-- NOTE: role_permission_defaults seed data moved to 005500_permissions_core.sql

-- ############################################################################
-- PART 8: GRANTS
-- ############################################################################

-- NOTE: has_company_permission grant moved to 005500_permissions_core.sql
grant execute on function has_feature(uuid, text) to authenticated;
grant execute on function get_company_features(uuid) to authenticated;
grant execute on function get_company_subscription(uuid) to authenticated;
