-- ============================================================================
-- Migration: notifications
-- Description: Push notification device registry, in-app notification system
--              with persistence, notification type and recipient role enums,
--              helper functions for read marking and cleanup, and realtime
--              publication for live notification delivery.
-- Dependencies: auth.users, companies, core_functions (update_timestamp)
-- Sources: 032_user_devices (DDL, RLS, deactivate_stale_devices),
--          046_notifications (notification_type enum initial 6, recipient_role
--          enum, DDL, RLS, mark_all_notifications_read,
--          cleanup_old_notifications, realtime for notifications),
--          048_add_product_new_notification (product_new enum value),
--          061_notification_type_transaction_matched (transaction_matched),
--          066_notification_type_monobank_sync (monobank_accounts_sync_completed,
--          meta_conversations_import_completed)
-- ============================================================================

-- ############################################################################
-- PART 1: ENUM TYPES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Type: notification_type
-- Merged from 046 + 048 + 061 + 066. All 10 values defined from day one
-- (eliminates 4 separate ALTER TYPE ADD VALUE migrations).
-- ----------------------------------------------------------------------------

create type notification_type as enum (
	'order_new',
	'order_status',
	'chat_message',
	'payment_received',
	'product_update',
	'company_follow',
	'product_new',
	'transaction_matched',
	'monobank_accounts_sync_completed',
	'meta_conversations_import_completed'
);

comment on type notification_type is 'Types of in-app notifications: order_new, order_status, chat_message, payment_received, product_update, company_follow, product_new, transaction_matched, monobank_accounts_sync_completed, meta_conversations_import_completed';

-- ----------------------------------------------------------------------------
-- Type: notification_recipient_role (from 046)
-- ----------------------------------------------------------------------------

create type notification_recipient_role as enum (
	'company_member',
	'customer'
);

comment on type notification_recipient_role is 'Role context for notification delivery (Panel vs Account view)';

-- ############################################################################
-- PART 2: USER DEVICES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: user_devices (from 032)
-- Push notification device registry for users.
-- ----------------------------------------------------------------------------

create table if not exists user_devices (
	id            uuid        default gen_random_uuid() primary key,
	user_id       uuid        not null references auth.users (id) on delete cascade,
	device_token  text        not null,
	platform      text        not null
		check (platform in ('ios', 'android', 'web')),
	push_provider text        not null
		check (push_provider in ('fcm', 'apns', 'expo')),
	is_active     boolean     not null default true,
	device_name   text,
	app_version   text,
	os_version    text,
	created_at    timestamptz default now(),
	updated_at    timestamptz default now(),
	last_used_at  timestamptz default now(),

	unique (user_id, device_token)
);

comment on table user_devices is 'Push notification device registry for users';
comment on column user_devices.device_token is 'Push notification token (FCM, APNs, or Expo)';
comment on column user_devices.platform is 'Device platform: ios, android, or web';
comment on column user_devices.push_provider is 'Push notification provider: fcm, apns, or expo';
comment on column user_devices.is_active is 'Whether this device should receive notifications';
comment on column user_devices.device_name is 'Human-readable device name';
comment on column user_devices.app_version is 'App version for the device';
comment on column user_devices.os_version is 'Operating system version';
comment on column user_devices.last_used_at is 'Last time the device was used';

-- ----------------------------------------------------------------------------
-- Indexes (user_devices) — 3 kept, 1 removed as redundant
-- Removed: idx_user_devices_user_id — covered by unique constraint
--          (user_id, device_token) prefix.
-- ----------------------------------------------------------------------------

create index idx_user_devices_active on user_devices (user_id)
	where is_active = true;

create index idx_user_devices_token on user_devices (device_token);

create index idx_user_devices_platform on user_devices (platform)
	where is_active = true;

-- ----------------------------------------------------------------------------
-- RLS (user_devices) — from 032, unchanged (self CRUD)
-- ----------------------------------------------------------------------------

alter table user_devices enable row level security;
alter table user_devices force row level security;

create policy "user_devices: self select"
	on user_devices
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "user_devices: self insert"
	on user_devices
	for insert
	to authenticated
	with check (user_id = (select auth.uid()));

create policy "user_devices: self update"
	on user_devices
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "user_devices: self delete"
	on user_devices
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Trigger (user_devices)
-- ----------------------------------------------------------------------------

create trigger user_devices_update_timestamp
	before update on user_devices
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: NOTIFICATIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: notifications (from 046)
-- In-app notifications with persistence for notification center.
-- ----------------------------------------------------------------------------

create table if not exists notifications (
	id             uuid                        default gen_random_uuid() primary key,
	user_id        uuid                        not null references auth.users (id) on delete cascade,
	company_id     uuid                        references companies (id) on delete cascade,
	type           notification_type           not null,
	title          text                        not null,
	body           text,
	data           jsonb                       default '{}'::jsonb,
	recipient_role notification_recipient_role not null,
	read_at        timestamptz,
	clicked_at     timestamptz,
	created_at     timestamptz                 default now()
);

comment on table notifications is 'In-app notifications with persistence for notification center';
comment on column notifications.user_id is 'User who receives this notification';
comment on column notifications.company_id is 'Company context for the notification (for filtering)';
comment on column notifications.type is 'Notification type for icon and routing';
comment on column notifications.title is 'Notification title (short, shown in bell dropdown)';
comment on column notifications.body is 'Notification body (longer description)';
comment on column notifications.data is 'Type-specific payload (order_id, product_id, tracking_token, etc.)';
comment on column notifications.recipient_role is 'Whether this is for company member (Panel) or customer (Account) view';
comment on column notifications.read_at is 'When notification was marked as read';
comment on column notifications.clicked_at is 'When notification was clicked (navigated to target)';

-- ----------------------------------------------------------------------------
-- Indexes (notifications) — 4 from 046, unchanged
-- ----------------------------------------------------------------------------

create index idx_notifications_user_role_created
	on notifications (user_id, recipient_role, created_at desc);

create index idx_notifications_user_unread
	on notifications (user_id, recipient_role)
	where read_at is null;

create index idx_notifications_company
	on notifications (company_id, created_at desc)
	where company_id is not null;

create index idx_notifications_type
	on notifications (user_id, type, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS (notifications) — from 046, unchanged
-- No INSERT policy — notifications are created by backend/service_role only.
-- ----------------------------------------------------------------------------

alter table notifications enable row level security;
alter table notifications force row level security;

create policy "notifications: self select"
	on notifications
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "notifications: self update"
	on notifications
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "notifications: self delete"
	on notifications
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

-- ############################################################################
-- PART 4: FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: deactivate_stale_devices (from 032)
-- SECURITY DEFINER. Deactivates devices not used in 90 days.
-- Improvement: fixed search_path from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function deactivate_stale_devices()
	returns integer
	language plpgsql
	security definer
	set search_path = ''
as $$
declare
	v_count integer;
begin
	update public.user_devices
	set is_active = false,
	    updated_at = now()
	where is_active = true
	  and last_used_at < now() - interval '90 days';

	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

comment on function deactivate_stale_devices() is
	'Deactivates devices not used in 90 days, returns count of deactivated devices';

-- ----------------------------------------------------------------------------
-- Function: mark_all_notifications_read (from 046)
-- SECURITY DEFINER RPC. Marks all unread notifications as read for a user by
-- role.
-- Improvement: fixed search_path from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function mark_all_notifications_read(
	p_user_id uuid,
	p_recipient_role notification_recipient_role
)
	returns integer
	language plpgsql
	security definer
	set search_path = ''
as $$
declare
	v_count integer;
begin
	if p_user_id != (select auth.uid()) then
		raise exception 'AUTH_MISMATCH:User ID does not match authenticated user';
	end if;

	update public.notifications
	set read_at = now()
	where user_id = p_user_id
	  and recipient_role = p_recipient_role
	  and read_at is null;

	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

comment on function mark_all_notifications_read(uuid, notification_recipient_role) is
	'Mark all unread notifications as read for a user, returns count updated';

grant execute on function mark_all_notifications_read(uuid, notification_recipient_role) to authenticated;

-- ----------------------------------------------------------------------------
-- Function: cleanup_old_notifications (from 046)
-- SECURITY DEFINER. Deletes notifications older than specified days.
-- Improvement: fixed search_path from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function cleanup_old_notifications(p_days_old integer default 90)
	returns integer
	language plpgsql
	security definer
	set search_path = ''
as $$
declare
	v_count integer;
begin
	delete from public.notifications
	where created_at < now() - (p_days_old || ' days')::interval;

	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

comment on function cleanup_old_notifications(integer) is
	'Delete notifications older than specified days (default 90), returns count deleted';

grant execute on function deactivate_stale_devices to service_role;
grant execute on function cleanup_old_notifications to service_role;

-- ############################################################################
-- PART 5: REALTIME CONFIGURATION
-- ############################################################################

alter publication supabase_realtime add table notifications;
