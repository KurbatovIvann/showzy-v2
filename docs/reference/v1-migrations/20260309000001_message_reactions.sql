-- ############################################################################
-- MESSAGE REACTIONS
-- ############################################################################
--
-- Adds emoji reactions to messages. Conversations are 1:1 (no group chats),
-- so per message per emoji there are at most 2 reactions (one per participant).
-- The unique constraint (message_id, user_id, emoji) enforces this naturally.
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: message_reactions
-- ----------------------------------------------------------------------------

create table if not exists message_reactions (
	id              uuid        default gen_random_uuid() primary key,
	message_id      uuid        not null references messages (id) on delete cascade,
	user_id         uuid        not null references auth.users (id) on delete cascade,
	emoji           text        not null check (length(emoji) between 1 and 16),
	created_at      timestamptz not null default now(),

	constraint message_reactions_unique unique (message_id, user_id, emoji)
);

comment on table message_reactions is 'Emoji reactions on chat messages (1:1 conversations, max 2 per emoji per message)';

-- ----------------------------------------------------------------------------
-- Indexes (FK columns — per Supabase schema-foreign-key-indexes guideline)
-- ----------------------------------------------------------------------------

create index idx_message_reactions_message on message_reactions (message_id);
create index idx_message_reactions_user on message_reactions (user_id);

-- ----------------------------------------------------------------------------
-- RLS (mirrors messages table pattern from 20260301000015_messaging.sql)
-- ----------------------------------------------------------------------------

alter table message_reactions enable row level security;
alter table message_reactions force row level security;

create policy "message_reactions: select"
	on message_reactions
	for select
	to authenticated
	using (
		exists (
			select 1 from messages m
			join conversations c on c.id = m.conversation_id
			where m.id = message_reactions.message_id
			  and (
				(c.customer_user_id is not null and c.customer_user_id = (select auth.uid()))
				or has_company_permission(m.company_id, 'chat:view', (select auth.uid()))
			  )
		)
	);

create policy "message_reactions: insert"
	on message_reactions
	for insert
	to authenticated
	with check (
		user_id = (select auth.uid())
		and exists (
			select 1 from messages m
			join conversations c on c.id = m.conversation_id
			where m.id = message_reactions.message_id
			  and (
				(c.customer_user_id is not null and c.customer_user_id = (select auth.uid()))
				or has_company_permission(m.company_id, 'chat:respond', (select auth.uid()))
			  )
		)
	);

create policy "message_reactions: delete own"
	on message_reactions
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Atomic toggle function
-- Avoids race conditions when both participants react simultaneously.
-- Deletes the reaction if it exists, inserts if not, then returns the
-- full updated reaction state for the message in one round-trip.
-- ----------------------------------------------------------------------------

create or replace function toggle_message_reaction(
	p_message_id uuid,
	p_user_id uuid,
	p_emoji text
) returns jsonb as $$
declare
	v_existed boolean;
	v_reactions jsonb;
begin
	delete from message_reactions
	where message_id = p_message_id
	  and user_id = p_user_id
	  and emoji = p_emoji;

	v_existed := found;

	if not v_existed then
		insert into message_reactions (message_id, user_id, emoji)
		values (p_message_id, p_user_id, p_emoji);
	end if;

	v_reactions := coalesce(
		(select jsonb_agg(jsonb_build_object(
			'emoji', r.emoji,
			'userIds', r.user_ids
		))
		from (
			select emoji, array_agg(user_id::text order by created_at) as user_ids
			from message_reactions
			where message_id = p_message_id
			group by emoji
		) r),
		'[]'::jsonb
	);

	return jsonb_build_object(
		'action', case when v_existed then 'remove' else 'add' end,
		'reactions', v_reactions
	);
end;
$$ language plpgsql security definer;

comment on function toggle_message_reaction is 'Atomically toggle a reaction and return updated reaction summary';
