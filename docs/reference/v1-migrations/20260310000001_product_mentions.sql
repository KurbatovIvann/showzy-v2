-- ============================================================================
-- Migration: product_mentions
-- Description: Adjust message_mentions for product card mentions.
--              Make start_index/end_index nullable (product mentions are cards,
--              not inline text), add company_id for direct querying and simpler
--              RLS, optimize RLS SELECT policy to a single EXISTS, add
--              composite index for batch loading by type.
-- Dependencies: messaging (message_mentions, messages, conversations)
-- ============================================================================

-- ############################################################################
-- PART 1: MAKE start_index / end_index NULLABLE
-- ############################################################################

alter table message_mentions
	drop constraint message_mentions_valid_range;

alter table message_mentions
	alter column start_index drop not null,
	alter column end_index   drop not null;

alter table message_mentions
	add constraint message_mentions_valid_range
		check (
			(start_index is null and end_index is null)
			or (start_index >= 0 and end_index > start_index)
		);

comment on column message_mentions.start_index is 'Start position of mention text in message content. NULL for card-style mentions (e.g. product cards).';
comment on column message_mentions.end_index   is 'End position of mention text in message content. NULL for card-style mentions (e.g. product cards).';

-- ############################################################################
-- PART 2: ADD company_id COLUMN
-- ############################################################################

alter table message_mentions
	add column company_id uuid references companies (id) on delete cascade;

update message_mentions mm
set company_id = m.company_id
from messages m
where mm.message_id = m.id
  and mm.company_id is null;

alter table message_mentions
	alter column company_id set not null;

create index idx_message_mentions_company on message_mentions (company_id);

comment on column message_mentions.company_id is 'Company that owns this mention (denormalized from messages for direct querying and RLS)';

-- ############################################################################
-- PART 3: OPTIMIZE RLS SELECT POLICY
-- ############################################################################

drop policy if exists "message_mentions: select" on message_mentions;

create policy "message_mentions: select"
	on message_mentions
	for select
	to authenticated
	using (
		exists (
			select 1 from messages m
			join conversations c on c.id = m.conversation_id
			where m.id = message_mentions.message_id
			  and (
				  (c.customer_user_id is not null and c.customer_user_id = (select auth.uid()))
				  or has_company_permission(m.company_id, 'chat:view', (select auth.uid()))
			  )
		)
	);

-- Allow service_role to insert mentions (for server-side snapshot creation)
drop policy if exists "message_mentions: sender insert" on message_mentions;

create policy "message_mentions: sender insert"
	on message_mentions
	for insert
	to authenticated
	with check (
		exists (
			select 1 from messages m
			where m.id = message_mentions.message_id
			  and (
				  m.sender_user_id = (select auth.uid())
				  or has_company_permission(m.company_id, 'chat:respond', (select auth.uid()))
			  )
		)
	);

-- ############################################################################
-- PART 4: ADDITIONAL INDEX FOR BATCH LOADING
-- ############################################################################

create index idx_message_mentions_message_entity_type
	on message_mentions (message_id, entity_type);
