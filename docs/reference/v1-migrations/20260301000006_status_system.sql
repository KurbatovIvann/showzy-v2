-- ============================================================================
-- Migration: status_system
-- Description: Status template seed data (read-only reference tables) and
--              company-specific status management (statuses, transitions,
--              automations). Templates define prebuilt workflows that companies
--              can adopt; company_statuses/transitions/automations hold the
--              per-company runtime configuration.
-- Dependencies: companies, core_functions (update_timestamp), company_members
--              (is_company_member for RLS)
-- Sources: 006_status_templates, 007_company_statuses, 062_permissions_enforcement
-- ============================================================================

-- ############################################################################
-- PART 1: STATUS TEMPLATES (read-only seed data)
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: status_templates
-- ----------------------------------------------------------------------------

create table if not exists status_templates (
	id          uuid        default gen_random_uuid() primary key,
	code        text        not null unique,
	name        text        not null,
	description text,
	entity_type text        not null check (entity_type in ('order', 'product')),
	created_at  timestamptz default now()
);

comment on table status_templates is 'Predefined status templates for different business types';

-- ----------------------------------------------------------------------------
-- Table: status_template_items
-- ----------------------------------------------------------------------------

create table if not exists status_template_items (
	id          uuid    default gen_random_uuid() primary key,
	template_id uuid    not null references status_templates (id) on delete cascade,
	code        text    not null,
	name        text    not null,
	color       text    not null default '#6b7280',
	icon        text    not null default 'circle',
	sort_order  int     not null default 0,
	is_default  boolean default false,
	is_final    boolean default false,

	constraint status_template_items_unique unique (template_id, code)
);

comment on table status_template_items is 'Individual status items within a template';

-- ----------------------------------------------------------------------------
-- Table: status_template_transitions
-- ----------------------------------------------------------------------------

create table if not exists status_template_transitions (
	id               uuid default gen_random_uuid() primary key,
	template_id      uuid not null references status_templates (id) on delete cascade,
	from_status_code text not null,
	to_status_code   text not null,

	constraint status_template_transitions_unique unique (template_id, from_status_code, to_status_code)
);

comment on table status_template_transitions is 'Allowed status transitions within a template';

-- ----------------------------------------------------------------------------
-- Indexes (templates)
-- ----------------------------------------------------------------------------

create index idx_status_templates_entity_type on status_templates (entity_type);
create index idx_status_template_items_template on status_template_items (template_id);
create index idx_status_template_transitions_template on status_template_transitions (template_id);

-- ----------------------------------------------------------------------------
-- RLS (templates) — read-only seed data, public read access
-- ----------------------------------------------------------------------------

alter table status_templates enable row level security;
alter table status_templates force row level security;

create policy "status_templates: public read"
	on status_templates
	for select
	to anon, authenticated
	using (true);

alter table status_template_items enable row level security;
alter table status_template_items force row level security;

create policy "status_template_items: public read"
	on status_template_items
	for select
	to anon, authenticated
	using (true);

alter table status_template_transitions enable row level security;
alter table status_template_transitions force row level security;

create policy "status_template_transitions: public read"
	on status_template_transitions
	for select
	to anon, authenticated
	using (true);

-- ############################################################################
-- PART 2: COMPANY-SPECIFIC STATUS MANAGEMENT
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: company_statuses
-- ----------------------------------------------------------------------------

create table if not exists company_statuses (
	id          uuid        default gen_random_uuid() primary key,
	company_id  uuid        not null references companies (id) on delete cascade,
	entity_type text        not null check (entity_type in ('order', 'product')),
	code        text        not null,
	name        text        not null,
	color       text        default '#6b7280',
	icon        text        default 'circle',
	sort_order  int         default 0,
	is_default  boolean     default false,
	is_final    boolean     default false,
	created_at  timestamptz default now(),
	updated_at  timestamptz default now(),

	constraint company_statuses_unique_code unique (company_id, entity_type, code)
);

comment on table  company_statuses             is 'Company-specific statuses for orders and products';
comment on column company_statuses.entity_type is 'Type of entity this status applies to: order or product';
comment on column company_statuses.is_default  is 'Whether this is the default status for new entities';
comment on column company_statuses.is_final    is 'Whether this status represents a terminal state';

-- ----------------------------------------------------------------------------
-- Indexes (company_statuses)
-- The unique constraint (company_id, entity_type, code) already covers
-- queries on (company_id) and (company_id, entity_type) via prefix matching.
-- Only the partial unique index for enforcing one default per type is needed.
-- ----------------------------------------------------------------------------

create unique index idx_company_statuses_one_default
	on company_statuses (company_id, entity_type)
	where is_default = true;

-- ----------------------------------------------------------------------------
-- RLS (company_statuses) — public read + member write (final state from 062)
-- ----------------------------------------------------------------------------

alter table company_statuses enable row level security;
alter table company_statuses force row level security;

create policy "company_statuses: public read"
	on company_statuses
	for select
	using (true);

create policy "company_statuses: member insert"
	on company_statuses
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "company_statuses: member update"
	on company_statuses
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "company_statuses: member delete"
	on company_statuses
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (company_statuses)
-- ----------------------------------------------------------------------------

create trigger company_statuses_update_timestamp
	before update on company_statuses
	for each row
	execute function update_timestamp();

-- ----------------------------------------------------------------------------
-- Table: status_transitions
-- ----------------------------------------------------------------------------

create table if not exists status_transitions (
	id                    uuid        default gen_random_uuid() primary key,
	company_id            uuid        not null references companies (id) on delete cascade,
	from_status_id        uuid        not null references company_statuses (id) on delete cascade,
	to_status_id          uuid        not null references company_statuses (id) on delete cascade,
	requires_confirmation boolean     default false,
	created_at            timestamptz default now(),

	constraint status_transitions_unique unique (company_id, from_status_id, to_status_id),
	constraint status_transitions_no_self check (from_status_id != to_status_id)
);

comment on table status_transitions is 'Defines allowed status changes for a company';

-- ----------------------------------------------------------------------------
-- Indexes (status_transitions)
-- The unique constraint (company_id, from_status_id, to_status_id) covers
-- company_id as a prefix. Only FK indexes on from/to are needed.
-- ----------------------------------------------------------------------------

create index idx_status_transitions_from on status_transitions (from_status_id);
create index idx_status_transitions_to on status_transitions (to_status_id);

-- ----------------------------------------------------------------------------
-- RLS (status_transitions) — public read + member write (final state from 062)
-- ----------------------------------------------------------------------------

alter table status_transitions enable row level security;
alter table status_transitions force row level security;

create policy "status_transitions: public read"
	on status_transitions
	for select
	using (true);

create policy "status_transitions: member insert"
	on status_transitions
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "status_transitions: member update"
	on status_transitions
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "status_transitions: member delete"
	on status_transitions
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Table: status_automations
-- ----------------------------------------------------------------------------

create table if not exists status_automations (
	id            uuid        default gen_random_uuid() primary key,
	company_id    uuid        not null references companies (id) on delete cascade,
	status_id     uuid        not null references company_statuses (id) on delete cascade,
	trigger_type  text        not null check (trigger_type in ('on_enter', 'on_exit')),
	action_type   text        not null check (action_type in ('email', 'sms', 'webhook', 'internal')),
	action_config jsonb       not null default '{}',
	is_active     boolean     default true,
	created_at    timestamptz default now(),
	updated_at    timestamptz default now()
);

comment on table status_automations is 'Automated actions triggered by status changes';

-- ----------------------------------------------------------------------------
-- Indexes (status_automations)
-- ----------------------------------------------------------------------------

create index idx_status_automations_company on status_automations (company_id);
create index idx_status_automations_status on status_automations (status_id);
create index idx_status_automations_active on status_automations (status_id, is_active) where is_active = true;

-- ----------------------------------------------------------------------------
-- RLS (status_automations) — member-only, no public read (internal config)
-- Final state from 062.
-- ----------------------------------------------------------------------------

alter table status_automations enable row level security;
alter table status_automations force row level security;

create policy "status_automations: member select"
	on status_automations
	for select
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "status_automations: member insert"
	on status_automations
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "status_automations: member update"
	on status_automations
	for update
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

create policy "status_automations: member delete"
	on status_automations
	for delete
	to authenticated
	using (has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (status_automations)
-- ----------------------------------------------------------------------------

create trigger status_automations_update_timestamp
	before update on status_automations
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: SEED DATA
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Seed Data: Templates
-- ----------------------------------------------------------------------------

insert into status_templates (code, name, description, entity_type) values
	('general_order', 'General', 'Default order workflow', 'order'),
	('bakery_order', 'Bakery', 'Order workflow for bakeries', 'order'),
	('beauty_order', 'Beauty Salon', 'Order workflow for beauty salons', 'order'),
	('artisan_order', 'Artisan / Handmade', 'Order workflow for artisans and handmade goods', 'order'),
	('restaurant_order', 'Restaurant / Food Delivery', 'Order workflow for restaurants', 'order'),
	('general_product', 'General', 'Default product statuses', 'product')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- Seed Data: General Order Template
-- ----------------------------------------------------------------------------

insert into status_template_items (template_id, code, name, color, icon, sort_order, is_default, is_final)
select id, 'pending', 'Pending', '#eab308', 'clock', 0, true, false from status_templates where code = 'general_order'
union all
select id, 'confirmed', 'Confirmed', '#3b82f6', 'check-circle', 1, false, false from status_templates where code = 'general_order'
union all
select id, 'completed', 'Completed', '#22c55e', 'package-check', 2, false, true from status_templates where code = 'general_order'
union all
select id, 'cancelled', 'Cancelled', '#ef4444', 'x-circle', 3, false, true from status_templates where code = 'general_order'
on conflict (template_id, code) do nothing;

insert into status_template_transitions (template_id, from_status_code, to_status_code)
select id, 'pending', 'confirmed' from status_templates where code = 'general_order'
union all
select id, 'pending', 'cancelled' from status_templates where code = 'general_order'
union all
select id, 'confirmed', 'completed' from status_templates where code = 'general_order'
union all
select id, 'confirmed', 'cancelled' from status_templates where code = 'general_order'
on conflict (template_id, from_status_code, to_status_code) do nothing;

-- ----------------------------------------------------------------------------
-- Seed Data: Bakery Order Template
-- ----------------------------------------------------------------------------

insert into status_template_items (template_id, code, name, color, icon, sort_order, is_default, is_final)
select id, 'received', 'Order Received', '#eab308', 'clipboard-list', 0, true, false from status_templates where code = 'bakery_order'
union all
select id, 'confirmed', 'Confirmed', '#3b82f6', 'check-circle', 1, false, false from status_templates where code = 'bakery_order'
union all
select id, 'baking', 'Baking', '#f97316', 'flame', 2, false, false from status_templates where code = 'bakery_order'
union all
select id, 'ready', 'Ready for Pickup', '#8b5cf6', 'shopping-bag', 3, false, false from status_templates where code = 'bakery_order'
union all
select id, 'delivered', 'Delivered', '#22c55e', 'truck', 4, false, true from status_templates where code = 'bakery_order'
union all
select id, 'cancelled', 'Cancelled', '#ef4444', 'x-circle', 5, false, true from status_templates where code = 'bakery_order'
on conflict (template_id, code) do nothing;

insert into status_template_transitions (template_id, from_status_code, to_status_code)
select id, 'received', 'confirmed' from status_templates where code = 'bakery_order'
union all
select id, 'received', 'cancelled' from status_templates where code = 'bakery_order'
union all
select id, 'confirmed', 'baking' from status_templates where code = 'bakery_order'
union all
select id, 'confirmed', 'cancelled' from status_templates where code = 'bakery_order'
union all
select id, 'baking', 'ready' from status_templates where code = 'bakery_order'
union all
select id, 'ready', 'delivered' from status_templates where code = 'bakery_order'
on conflict (template_id, from_status_code, to_status_code) do nothing;

-- ----------------------------------------------------------------------------
-- Seed Data: Beauty Salon Order Template
-- ----------------------------------------------------------------------------

insert into status_template_items (template_id, code, name, color, icon, sort_order, is_default, is_final)
select id, 'booked', 'Booked', '#eab308', 'calendar', 0, true, false from status_templates where code = 'beauty_order'
union all
select id, 'confirmed', 'Confirmed', '#3b82f6', 'check-circle', 1, false, false from status_templates where code = 'beauty_order'
union all
select id, 'in_progress', 'In Progress', '#8b5cf6', 'sparkles', 2, false, false from status_templates where code = 'beauty_order'
union all
select id, 'completed', 'Completed', '#22c55e', 'heart', 3, false, true from status_templates where code = 'beauty_order'
union all
select id, 'cancelled', 'Cancelled', '#ef4444', 'x-circle', 4, false, true from status_templates where code = 'beauty_order'
on conflict (template_id, code) do nothing;

insert into status_template_transitions (template_id, from_status_code, to_status_code)
select id, 'booked', 'confirmed' from status_templates where code = 'beauty_order'
union all
select id, 'booked', 'cancelled' from status_templates where code = 'beauty_order'
union all
select id, 'confirmed', 'in_progress' from status_templates where code = 'beauty_order'
union all
select id, 'confirmed', 'cancelled' from status_templates where code = 'beauty_order'
union all
select id, 'in_progress', 'completed' from status_templates where code = 'beauty_order'
on conflict (template_id, from_status_code, to_status_code) do nothing;

-- ----------------------------------------------------------------------------
-- Seed Data: Artisan Order Template
-- ----------------------------------------------------------------------------

insert into status_template_items (template_id, code, name, color, icon, sort_order, is_default, is_final)
select id, 'received', 'Order Received', '#eab308', 'clipboard-list', 0, true, false from status_templates where code = 'artisan_order'
union all
select id, 'confirmed', 'Confirmed', '#3b82f6', 'check-circle', 1, false, false from status_templates where code = 'artisan_order'
union all
select id, 'in_production', 'In Production', '#f97316', 'hammer', 2, false, false from status_templates where code = 'artisan_order'
union all
select id, 'quality_check', 'Quality Check', '#8b5cf6', 'search', 3, false, false from status_templates where code = 'artisan_order'
union all
select id, 'shipped', 'Shipped', '#06b6d4', 'package', 4, false, false from status_templates where code = 'artisan_order'
union all
select id, 'delivered', 'Delivered', '#22c55e', 'check-check', 5, false, true from status_templates where code = 'artisan_order'
union all
select id, 'cancelled', 'Cancelled', '#ef4444', 'x-circle', 6, false, true from status_templates where code = 'artisan_order'
on conflict (template_id, code) do nothing;

insert into status_template_transitions (template_id, from_status_code, to_status_code)
select id, 'received', 'confirmed' from status_templates where code = 'artisan_order'
union all
select id, 'received', 'cancelled' from status_templates where code = 'artisan_order'
union all
select id, 'confirmed', 'in_production' from status_templates where code = 'artisan_order'
union all
select id, 'confirmed', 'cancelled' from status_templates where code = 'artisan_order'
union all
select id, 'in_production', 'quality_check' from status_templates where code = 'artisan_order'
union all
select id, 'quality_check', 'shipped' from status_templates where code = 'artisan_order'
union all
select id, 'shipped', 'delivered' from status_templates where code = 'artisan_order'
on conflict (template_id, from_status_code, to_status_code) do nothing;

-- ----------------------------------------------------------------------------
-- Seed Data: Restaurant Order Template
-- ----------------------------------------------------------------------------

insert into status_template_items (template_id, code, name, color, icon, sort_order, is_default, is_final)
select id, 'received', 'Order Received', '#eab308', 'clipboard-list', 0, true, false from status_templates where code = 'restaurant_order'
union all
select id, 'preparing', 'Preparing', '#f97316', 'chef-hat', 1, false, false from status_templates where code = 'restaurant_order'
union all
select id, 'ready', 'Ready', '#8b5cf6', 'utensils', 2, false, false from status_templates where code = 'restaurant_order'
union all
select id, 'out_for_delivery', 'Out for Delivery', '#06b6d4', 'bike', 3, false, false from status_templates where code = 'restaurant_order'
union all
select id, 'delivered', 'Delivered', '#22c55e', 'check-check', 4, false, true from status_templates where code = 'restaurant_order'
union all
select id, 'cancelled', 'Cancelled', '#ef4444', 'x-circle', 5, false, true from status_templates where code = 'restaurant_order'
on conflict (template_id, code) do nothing;

insert into status_template_transitions (template_id, from_status_code, to_status_code)
select id, 'received', 'preparing' from status_templates where code = 'restaurant_order'
union all
select id, 'received', 'cancelled' from status_templates where code = 'restaurant_order'
union all
select id, 'preparing', 'ready' from status_templates where code = 'restaurant_order'
union all
select id, 'preparing', 'cancelled' from status_templates where code = 'restaurant_order'
union all
select id, 'ready', 'out_for_delivery' from status_templates where code = 'restaurant_order'
union all
select id, 'out_for_delivery', 'delivered' from status_templates where code = 'restaurant_order'
on conflict (template_id, from_status_code, to_status_code) do nothing;

-- ----------------------------------------------------------------------------
-- Seed Data: General Product Template
-- ----------------------------------------------------------------------------

insert into status_template_items (template_id, code, name, color, icon, sort_order, is_default, is_final)
select id, 'active', 'Active', '#22c55e', 'check-circle', 0, true, false from status_templates where code = 'general_product'
union all
select id, 'inactive', 'Inactive', '#6b7280', 'pause-circle', 1, false, false from status_templates where code = 'general_product'
union all
select id, 'archived', 'Archived', '#9ca3af', 'archive', 2, false, true from status_templates where code = 'general_product'
on conflict (template_id, code) do nothing;
