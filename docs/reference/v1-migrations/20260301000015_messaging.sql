-- ============================================================================
-- Migration: messaging
-- Description: Conversations, messages, message mentions, conversation
--              participants, messaging contacts. Multi-channel support
--              (web, Instagram, Messenger, WhatsApp, Telegram, Viber) with
--              external contact handling, sequence-based message ordering,
--              and real-time unread counting.
-- Dependencies: companies, auth.users, company_members (is_company_member,
--               is_anonymous_user), company_customers, core_functions
--               (update_timestamp)
-- Sources: 028_conversations (DDL, sequence, indexes, RLS),
--          029_messages (DDL, indexes, RLS, update_conversation_on_message),
--          030_message_mentions (DDL, indexes, RLS),
--          031_conversation_participants (DDL, indexes, RLS,
--          create_conversation_participants, update_conversation_assignment),
--          049_add_order_content_type (content_type CHECK extended),
--          053_find_order_conversation_rpc (find_order_conversation),
--          057_messaging_channels (channel + external_contact_id on
--          conversations, external_message_id + channel_metadata on messages,
--          nullable customer_user_id/sender_user_id, messaging_contacts,
--          updated RLS + trigger),
--          060_fix_conversation_participants_trigger (NULL customer_user_id),
--          067_fix_messages_external_id_constraint (UNIQUE constraint),
--          073_increment_unread_count_rpc
-- ============================================================================

-- ############################################################################
-- PART 1: SEQUENCE
-- ############################################################################

create sequence conversation_message_seq
	start with 1
	increment by 1;

comment on sequence conversation_message_seq is 'Global sequence for message ordering within conversations';

-- ############################################################################
-- PART 2: CONVERSATIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: conversations
-- Merged from 028 + 057. Includes channel and external_contact_id from day
-- one. customer_user_id is nullable (external channel contacts may not have
-- Supabase accounts).
-- ----------------------------------------------------------------------------

create table if not exists conversations (
	id                    uuid        default gen_random_uuid() primary key,
	company_id            uuid        not null references companies (id) on delete cascade,
	customer_user_id      uuid        references auth.users (id) on delete cascade,
	channel               text        not null default 'web'
		check (channel in ('web', 'instagram', 'messenger', 'whatsapp', 'telegram', 'viber')),
	external_contact_id   text,
	status                text        not null default 'active'
		check (status in ('active', 'archived', 'blocked')),
	assigned_to           uuid        references auth.users (id) on delete set null,
	customer_name         text,
	last_message_text     text,
	last_message_at       timestamptz,
	last_message_by       text        check (last_message_by in ('customer', 'company_member')),
	company_unread_count  integer     not null default 0,
	customer_unread_count integer     not null default 0,
	created_at            timestamptz default now(),
	updated_at            timestamptz default now(),

	unique (company_id, customer_user_id)
);

comment on table conversations is 'Chat conversations between companies and customers';
comment on column conversations.channel is 'Messaging channel: web, instagram, messenger, whatsapp, telegram, viber';
comment on column conversations.external_contact_id is 'External contact identifier (PSID, IGSID, telegram chat_id)';
comment on column conversations.status is 'Conversation status: active, archived, or blocked';
comment on column conversations.assigned_to is 'Company member assigned to handle this conversation';
comment on column conversations.customer_name is 'Denormalized customer name for list queries';
comment on column conversations.last_message_text is 'Preview text of last message (truncated)';
comment on column conversations.last_message_at is 'Timestamp of last message for sorting';
comment on column conversations.last_message_by is 'Who sent the last message: customer or company_member. External contacts map to customer.';
comment on column conversations.company_unread_count is 'Number of unread messages for company';
comment on column conversations.customer_unread_count is 'Number of unread messages for customer';

-- ----------------------------------------------------------------------------
-- Indexes (conversations) — 8 kept, 1 removed as redundant
-- Removed: idx_conversations_company_id — covered by unique constraint
--          (company_id, customer_user_id) prefix and by
--          idx_conversations_last_message_at (company_id, ...).
-- ----------------------------------------------------------------------------

create index idx_conversations_customer_user_id on conversations (customer_user_id);
create index idx_conversations_assigned_to on conversations (assigned_to) where assigned_to is not null;
create index idx_conversations_last_message_at on conversations (company_id, last_message_at desc nulls last);
create index idx_conversations_company_unread on conversations (company_id)
	where company_unread_count > 0;
create index idx_conversations_customer_unread on conversations (customer_user_id)
	where customer_unread_count > 0;
create index idx_conversations_status on conversations (company_id, status);

create unique index idx_conversations_channel_contact
	on conversations (company_id, channel, external_contact_id)
	where channel != 'web' and external_contact_id is not null;

-- ----------------------------------------------------------------------------
-- RLS (conversations) — from 028 + 057, with null checks for nullable
-- customer_user_id
-- ----------------------------------------------------------------------------

alter table conversations enable row level security;
alter table conversations force row level security;

create policy "conversations: select"
	on conversations
	for select
	to authenticated
	using (
		(customer_user_id is not null and customer_user_id = (select auth.uid()))
		or has_company_permission(company_id, 'chat:view', (select auth.uid()))
	);

create policy "conversations: insert"
	on conversations
	for insert
	to authenticated
	with check (
		(customer_user_id is not null
		 and customer_user_id = (select auth.uid())
		 and not is_anonymous_user())
		or has_company_permission(company_id, 'chat:respond', (select auth.uid()))
	);

create policy "conversations: company member update"
	on conversations
	for update
	to authenticated
	using (has_company_permission(company_id, 'chat:respond', (select auth.uid())))
	with check (has_company_permission(company_id, 'chat:respond', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (conversations)
-- ----------------------------------------------------------------------------

create trigger conversations_update_timestamp
	before update on conversations
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 3: MESSAGES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: messages
-- Merged from 029 + 049 + 057 + 067. sender_user_id is nullable (external
-- senders). content_type includes 'order' and 'product' (from 049).
-- sender_type includes 'external_contact' (from 057). external_message_id
-- has a UNIQUE constraint (from 067, not the partial index from 057).
-- channel_metadata from 057.
-- ----------------------------------------------------------------------------

create table if not exists messages (
	id                  uuid        default gen_random_uuid() primary key,
	conversation_id     uuid        not null references conversations (id) on delete cascade,
	company_id          uuid        not null references companies (id) on delete cascade,
	sender_user_id      uuid        references auth.users (id) on delete cascade,
	sender_type         text        not null
		check (sender_type in ('customer', 'company_member', 'external_contact')),
	sender_name         text        not null,
	content             text        not null,
	content_type        text        not null default 'text'
		check (content_type in ('text', 'image', 'file', 'system', 'order', 'product')),
	metadata            jsonb       default '{}',
	channel_metadata    jsonb       default '{}',
	external_message_id text        unique,
	status              text        not null default 'sent'
		check (status in ('sending', 'sent', 'delivered', 'read', 'failed')),
	sequence_number     bigint      not null default nextval('conversation_message_seq'),
	created_at          timestamptz default now(),
	edited_at           timestamptz,
	deleted_at          timestamptz
);

comment on table messages is 'Chat messages within conversations';
comment on column messages.sender_type is 'Type of sender: customer, company_member, or external_contact';
comment on column messages.sender_name is 'Denormalized sender name at time of message';
comment on column messages.content_type is 'Type of content: text, image, file, system, order, or product';
comment on column messages.metadata is 'JSONB for mentions, reply_to message_id, attachments, etc.';
comment on column messages.channel_metadata is 'Channel-specific metadata (stickers, story mentions, media shares)';
comment on column messages.external_message_id is 'External message ID from messenger platform (for deduplication)';
comment on column messages.status is 'Message delivery status: sending, sent, delivered, read, failed';
comment on column messages.sequence_number is 'Global sequence number for total ordering';
comment on column messages.edited_at is 'Timestamp when message was last edited';
comment on column messages.deleted_at is 'Soft delete timestamp (null = not deleted)';

comment on constraint messages_external_message_id_key on messages is
	'Unique constraint on external_message_id for message deduplication. Allows NULLs (internal messages).';

-- ----------------------------------------------------------------------------
-- Indexes (messages) — 6 from 029, unchanged
-- Note: the partial index idx_messages_external_message_id from 057 is
-- replaced by the UNIQUE constraint messages_external_message_id_key (067).
-- ----------------------------------------------------------------------------

create index idx_messages_conversation_sequence on messages (conversation_id, sequence_number desc);
create index idx_messages_conversation_created on messages (conversation_id, created_at desc);
create index idx_messages_company_id on messages (company_id);
create index idx_messages_sender_user_id on messages (sender_user_id);
create index idx_messages_active on messages (conversation_id, sequence_number desc)
	where deleted_at is null;
create index idx_messages_metadata on messages using gin (metadata);

-- ----------------------------------------------------------------------------
-- RLS (messages) — from 029 + 057, with null checks for nullable
-- sender_user_id and customer_user_id
-- ----------------------------------------------------------------------------

alter table messages enable row level security;
alter table messages force row level security;

create policy "messages: select"
	on messages
	for select
	to authenticated
	using (
		exists (
			select 1 from conversations c
			where c.id = messages.conversation_id
			  and c.customer_user_id is not null
			  and c.customer_user_id = (select auth.uid())
		)
		or has_company_permission(company_id, 'chat:view', (select auth.uid()))
	);

create policy "messages: insert"
	on messages
	for insert
	to authenticated
	with check (
		(sender_user_id is not null
		 and sender_user_id = (select auth.uid())
		 and sender_type = 'customer'
		 and not is_anonymous_user()
		 and exists (
			select 1 from conversations c
			where c.id = messages.conversation_id
			  and c.customer_user_id = (select auth.uid())
		 ))
		or (sender_user_id = (select auth.uid())
			and sender_type = 'company_member'
			and has_company_permission(company_id, 'chat:respond', (select auth.uid())))
	);

create policy "messages: sender update"
	on messages
	for update
	to authenticated
	using (sender_user_id is not null and sender_user_id = (select auth.uid()))
	with check (sender_user_id is not null and sender_user_id = (select auth.uid()));

-- ############################################################################
-- PART 4: MESSAGE MENTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: message_mentions (from 030)
-- Rich mentions for products, orders, and customers in messages.
-- ----------------------------------------------------------------------------

create table if not exists message_mentions (
	id              uuid        default gen_random_uuid() primary key,
	message_id      uuid        not null references messages (id) on delete cascade,
	entity_type     text        not null
		check (entity_type in ('product', 'order', 'customer')),
	entity_id       uuid        not null,
	start_index     integer     not null,
	end_index       integer     not null,
	entity_snapshot jsonb       not null default '{}',
	created_at      timestamptz default now(),

	constraint message_mentions_valid_range check (start_index >= 0 and end_index > start_index)
);

comment on table message_mentions is 'Rich mentions of products, orders, and customers in chat messages';
comment on column message_mentions.entity_type is 'Type of mentioned entity: product, order, or customer';
comment on column message_mentions.entity_id is 'ID of the mentioned entity';
comment on column message_mentions.start_index is 'Start position of mention text in message content';
comment on column message_mentions.end_index is 'End position of mention text in message content';
comment on column message_mentions.entity_snapshot is 'Snapshot of entity data at time of mention (name, price, status, etc.)';

-- ----------------------------------------------------------------------------
-- Indexes (message_mentions) — 2 kept, 1 removed as redundant
-- Removed: idx_message_mentions_entity_type — covered by
--          idx_message_mentions_entity (entity_type, entity_id) prefix.
-- ----------------------------------------------------------------------------

create index idx_message_mentions_message_id on message_mentions (message_id);
create index idx_message_mentions_entity on message_mentions (entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- RLS (message_mentions) — from 030, unchanged
-- ----------------------------------------------------------------------------

alter table message_mentions enable row level security;
alter table message_mentions force row level security;

create policy "message_mentions: select"
	on message_mentions
	for select
	to authenticated
	using (
		exists (
			select 1 from messages m
			join conversations c on c.id = m.conversation_id
			where m.id = message_mentions.message_id
			  and c.customer_user_id = (select auth.uid())
		)
		or exists (
			select 1 from messages m
			where m.id = message_mentions.message_id
			  and has_company_permission(m.company_id, 'chat:view', (select auth.uid()))
		)
	);

create policy "message_mentions: sender insert"
	on message_mentions
	for insert
	to authenticated
	with check (
		exists (
			select 1 from messages m
			where m.id = message_mentions.message_id
			  and m.sender_user_id = (select auth.uid())
		)
	);

-- ############################################################################
-- PART 5: CONVERSATION PARTICIPANTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: conversation_participants (from 031)
-- Multi-participant tracking with read receipts.
-- ----------------------------------------------------------------------------

create table if not exists conversation_participants (
	id                    uuid        default gen_random_uuid() primary key,
	conversation_id       uuid        not null references conversations (id) on delete cascade,
	user_id               uuid        not null references auth.users (id) on delete cascade,
	role                  text        not null default 'participant'
		check (role in ('customer', 'company_member', 'participant')),
	last_seen_at          timestamptz,
	last_seen_message_id  uuid        references messages (id) on delete set null,
	notifications_enabled boolean     not null default true,
	created_at            timestamptz default now(),
	updated_at            timestamptz default now(),

	unique (conversation_id, user_id)
);

comment on table conversation_participants is 'Participants in a conversation with read tracking';
comment on column conversation_participants.role is 'Role of participant: customer, company_member, or participant';
comment on column conversation_participants.last_seen_at is 'Timestamp when user last viewed the conversation';
comment on column conversation_participants.last_seen_message_id is 'ID of last message seen by this participant';
comment on column conversation_participants.notifications_enabled is 'Whether push notifications are enabled for this conversation';

-- ----------------------------------------------------------------------------
-- Indexes (conversation_participants) — 2 kept, 1 removed as redundant
-- Removed: idx_conversation_participants_conversation — covered by unique
--          constraint (conversation_id, user_id) prefix.
-- ----------------------------------------------------------------------------

create index idx_conversation_participants_user on conversation_participants (user_id);
create index idx_conversation_participants_notifications on conversation_participants (user_id)
	where notifications_enabled = true;

-- ----------------------------------------------------------------------------
-- RLS (conversation_participants) — from 031, unchanged
-- ----------------------------------------------------------------------------

alter table conversation_participants enable row level security;
alter table conversation_participants force row level security;

create policy "conversation_participants: select"
	on conversation_participants
	for select
	to authenticated
	using (
		user_id = (select auth.uid())
		or exists (
			select 1 from conversation_participants cp
			where cp.conversation_id = conversation_participants.conversation_id
			  and cp.user_id = (select auth.uid())
		)
		or exists (
			select 1 from conversations c
			where c.id = conversation_participants.conversation_id
			  and has_company_permission(c.company_id, 'chat:view', (select auth.uid()))
		)
	);

create policy "conversation_participants: self update"
	on conversation_participants
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "conversation_participants: insert"
	on conversation_participants
	for insert
	to authenticated
	with check (
		user_id = (select auth.uid())
		or exists (
			select 1 from conversations c
			where c.id = conversation_participants.conversation_id
			  and has_company_permission(c.company_id, 'chat:respond', (select auth.uid()))
		)
	);

-- ----------------------------------------------------------------------------
-- Trigger (conversation_participants)
-- ----------------------------------------------------------------------------

create trigger conversation_participants_update_timestamp
	before update on conversation_participants
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 6: MESSAGING CONTACTS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: messaging_contacts (from 057)
-- External contact profiles from messenger platforms.
-- ----------------------------------------------------------------------------

create table if not exists messaging_contacts (
	id                  uuid        default gen_random_uuid() primary key,
	company_id          uuid        not null references companies (id) on delete cascade,
	channel             text        not null
		check (channel in ('instagram', 'messenger', 'whatsapp', 'telegram', 'viber')),
	external_id         text        not null,
	display_name        text,
	profile_pic_url     text,
	raw_profile         jsonb       default '{}',
	linked_customer_id  uuid        references company_customers (id) on delete set null,
	created_at          timestamptz default now(),
	updated_at          timestamptz default now(),

	unique (company_id, channel, external_id)
);

comment on table messaging_contacts is 'External contact profiles from messenger platforms';
comment on column messaging_contacts.channel is 'Messaging channel: instagram, messenger, whatsapp, telegram, viber';
comment on column messaging_contacts.external_id is 'Platform-specific contact ID (PSID, IGSID, telegram chat_id)';
comment on column messaging_contacts.display_name is 'Contact display name from the platform';
comment on column messaging_contacts.profile_pic_url is 'Contact profile picture URL from the platform';
comment on column messaging_contacts.raw_profile is 'Raw profile data from the platform API';
comment on column messaging_contacts.linked_customer_id is 'Optional link to company_customers for unified customer view';

-- ----------------------------------------------------------------------------
-- Indexes (messaging_contacts) — 1 kept, 2 removed as redundant
-- Removed: idx_messaging_contacts_company_id — covered by unique constraint
--          (company_id, channel, external_id) prefix.
-- Removed: idx_messaging_contacts_channel — covered by unique constraint
--          (company_id, channel, external_id) prefix for (company_id, channel).
-- ----------------------------------------------------------------------------

create index idx_messaging_contacts_linked_customer on messaging_contacts (linked_customer_id)
	where linked_customer_id is not null;

-- ----------------------------------------------------------------------------
-- RLS (messaging_contacts) — upgraded to is_company_member (per user decision)
-- Original from 057 used is_company_owner for write + is_company_member for
-- read. Unified to is_company_member for consistency with other domains.
-- ----------------------------------------------------------------------------

alter table messaging_contacts enable row level security;
alter table messaging_contacts force row level security;

create policy "messaging_contacts: member select"
	on messaging_contacts
	for select
	to authenticated
	using (has_company_permission(company_id, 'chat:view', (select auth.uid())));

create policy "messaging_contacts: member insert"
	on messaging_contacts
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'chat:respond', (select auth.uid())));

create policy "messaging_contacts: member update"
	on messaging_contacts
	for update
	to authenticated
	using (has_company_permission(company_id, 'chat:respond', (select auth.uid())))
	with check (has_company_permission(company_id, 'chat:respond', (select auth.uid())));

create policy "messaging_contacts: member delete"
	on messaging_contacts
	for delete
	to authenticated
	using (has_company_permission(company_id, 'chat:respond', (select auth.uid())));

-- ----------------------------------------------------------------------------
-- Trigger (messaging_contacts)
-- ----------------------------------------------------------------------------

create trigger messaging_contacts_update_timestamp
	before update on messaging_contacts
	for each row
	execute function update_timestamp();

-- ############################################################################
-- PART 7: FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: update_conversation_on_message (final version from 057)
-- SECURITY DEFINER trigger. Updates conversation denormalized fields when a
-- new message is inserted. Handles external_contact sender type by mapping
-- to 'customer' for last_message_by and unread counting. Excludes 'order'
-- content_type from unread increments.
-- Improvement: fixed search_path from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function update_conversation_on_message()
	returns trigger
	language plpgsql
	security definer
	set search_path = ''
as $$
declare
	v_truncated_text text;
begin
	v_truncated_text := left(new.content, 100);
	if length(new.content) > 100 then
		v_truncated_text := v_truncated_text || '...';
	end if;

	update public.conversations
	set last_message_text = v_truncated_text,
	    last_message_at = new.created_at,
	    last_message_by = case
	        when new.sender_type = 'external_contact' then 'customer'
	        else new.sender_type
	    end,
	    updated_at = now(),
	    company_unread_count = case
	        when (new.sender_type = 'customer' or new.sender_type = 'external_contact')
	             and new.content_type != 'order'
	        then company_unread_count + 1
	        else company_unread_count
	    end,
	    customer_unread_count = case
	        when new.sender_type = 'company_member'
	             and new.content_type != 'order'
	        then customer_unread_count + 1
	        else customer_unread_count
	    end
	where id = new.conversation_id;

	return new;
end;
$$;

comment on function update_conversation_on_message() is
	'Updates conversation denormalized fields when a new message is inserted. Maps external_contact to customer for unread counting. Excludes order messages from unread increment.';

-- ----------------------------------------------------------------------------
-- Function: create_conversation_participants (final version from 060)
-- SECURITY DEFINER trigger. Auto-creates participant records when a
-- conversation is created. Handles NULL customer_user_id for external
-- channel conversations.
-- Improvement: fixed search_path from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function create_conversation_participants()
	returns trigger
	language plpgsql
	security definer
	set search_path = ''
as $$
begin
	if new.customer_user_id is not null then
		insert into public.conversation_participants (conversation_id, user_id, role)
		values (new.id, new.customer_user_id, 'customer')
		on conflict (conversation_id, user_id) do nothing;
	end if;

	if new.assigned_to is not null then
		insert into public.conversation_participants (conversation_id, user_id, role)
		values (new.id, new.assigned_to, 'company_member')
		on conflict (conversation_id, user_id) do nothing;
	end if;

	return new;
end;
$$;

comment on function create_conversation_participants() is
	'Auto-creates participant records when a conversation is created. Skips customer participant for external channel conversations where customer_user_id is NULL.';

-- ----------------------------------------------------------------------------
-- Function: update_conversation_assignment (from 031)
-- SECURITY DEFINER trigger. Adds new participant when conversation
-- assignment changes.
-- Improvement: fixed search_path from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function update_conversation_assignment()
	returns trigger
	language plpgsql
	security definer
	set search_path = ''
as $$
begin
	if new.assigned_to is not null and (old.assigned_to is null or new.assigned_to != old.assigned_to) then
		insert into public.conversation_participants (conversation_id, user_id, role)
		values (new.id, new.assigned_to, 'company_member')
		on conflict (conversation_id, user_id) do nothing;
	end if;

	return new;
end;
$$;

comment on function update_conversation_assignment() is
	'Adds new participant when conversation assignment changes';

-- ----------------------------------------------------------------------------
-- Function: find_order_conversation (from 053)
-- SECURITY DEFINER RPC. Finds the conversation and order message for a given
-- order in a single JOIN query. Already uses search_path = '' with qualified
-- tables.
-- ----------------------------------------------------------------------------

create or replace function find_order_conversation(
	p_company_id uuid,
	p_customer_user_id uuid,
	p_order_id uuid
)
returns table(conversation_id uuid, message_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
	select c.id as conversation_id, m.id as message_id
	from public.conversations c
	left join public.messages m on m.conversation_id = c.id
		and m.content_type = 'order'
		and m.metadata @> jsonb_build_object('orderId', p_order_id::text)
	where c.company_id = p_company_id
		and c.customer_user_id = p_customer_user_id
	limit 1;
$$;

comment on function find_order_conversation(uuid, uuid, uuid) is
	'Finds the conversation and order message for a given order. Used by the notification service for real-time order updates.';

grant execute on function find_order_conversation(uuid, uuid, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- Function: increment_unread_count (from 073)
-- SECURITY DEFINER RPC. Atomic increment for conversation unread counts.
-- Eliminates read-modify-write race condition.
-- Improvement: fixed search_path from 'public' to '' with qualified tables.
-- ----------------------------------------------------------------------------

create or replace function increment_unread_count(
	conversation_id uuid,
	column_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if column_name = 'company_unread_count' then
		update public.conversations
		set company_unread_count = company_unread_count + 1
		where id = conversation_id;
	elsif column_name = 'customer_unread_count' then
		update public.conversations
		set customer_unread_count = customer_unread_count + 1
		where id = conversation_id;
	else
		raise exception 'Invalid column_name: %', column_name;
	end if;
end;
$$;

grant execute on function increment_unread_count(uuid, text) to service_role;

-- ############################################################################
-- PART 8: TRIGGERS ON MESSAGES AND CONVERSATIONS
-- ############################################################################

create trigger messages_update_conversation
	after insert on messages
	for each row
	execute function update_conversation_on_message();

create trigger conversations_create_participants
	after insert on conversations
	for each row
	execute function create_conversation_participants();

create trigger conversations_update_assignment
	after update of assigned_to on conversations
	for each row
	execute function update_conversation_assignment();
