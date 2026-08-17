-- ============================================================================
-- Migration: messaging_enhancements
-- Description: Restrict one reaction per user per message (Instagram/Telegram
--              behaviour) and add last_message_content_type to conversations
--              for type-appropriate chat list preview labels.
-- Consolidates: 0321_002 + 0322
-- Dependencies: messaging (20260301000015)
-- ============================================================================

-- ############################################################################
-- PART 1: RESTRICT ONE REACTION PER USER PER MESSAGE
-- ############################################################################

-- Clean up any duplicate rows (same message_id + user_id but different emoji).
-- Keep only the newest one.
DELETE FROM message_reactions a
USING message_reactions b
WHERE a.message_id = b.message_id
  AND a.user_id    = b.user_id
  AND a.created_at < b.created_at;

ALTER TABLE message_reactions
  DROP CONSTRAINT message_reactions_unique;

ALTER TABLE message_reactions
  ADD CONSTRAINT message_reactions_one_per_user UNIQUE (message_id, user_id);

-- ----------------------------------------------------------------------------
-- Updated RPC: one-reaction-per-user toggle
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION toggle_message_reaction(
	p_message_id uuid,
	p_user_id uuid,
	p_emoji text
) RETURNS jsonb AS $$
DECLARE
	v_existing_emoji text;
	v_action text;
	v_reactions jsonb;
BEGIN
	SELECT emoji INTO v_existing_emoji
	FROM message_reactions
	WHERE message_id = p_message_id
	  AND user_id = p_user_id;

	IF v_existing_emoji IS NOT NULL THEN
		DELETE FROM message_reactions
		WHERE message_id = p_message_id
		  AND user_id = p_user_id;

		IF v_existing_emoji = p_emoji THEN
			v_action := 'remove';
		ELSE
			INSERT INTO message_reactions (message_id, user_id, emoji)
			VALUES (p_message_id, p_user_id, p_emoji);
			v_action := 'replace';
		END IF;
	ELSE
		INSERT INTO message_reactions (message_id, user_id, emoji)
		VALUES (p_message_id, p_user_id, p_emoji);
		v_action := 'add';
	END IF;

	v_reactions := coalesce(
		(SELECT jsonb_agg(jsonb_build_object(
			'emoji', r.emoji,
			'userIds', r.user_ids
		))
		FROM (
			SELECT emoji, array_agg(user_id::text ORDER BY created_at) AS user_ids
			FROM message_reactions
			WHERE message_id = p_message_id
			GROUP BY emoji
		) r),
		'[]'::jsonb
	);

	RETURN jsonb_build_object(
		'action', v_action,
		'reactions', v_reactions
	);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ############################################################################
-- PART 2: ADD last_message_content_type TO conversations
-- ############################################################################

alter table conversations
	add column if not exists last_message_content_type text not null default 'text';

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
	set last_message_text         = v_truncated_text,
	    last_message_content_type = new.content_type,
	    last_message_at           = new.created_at,
	    last_message_by           = case
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

comment on column conversations.last_message_content_type is
	'Content type of the last message (text, image, file, audio, system, order, product). Used for type-appropriate preview labels in chat lists.';
