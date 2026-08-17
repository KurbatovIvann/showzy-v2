-- Add 'draft' to conversation status enum.
-- Draft conversations are created when a customer clicks "Message" but hasn't
-- sent a message yet. They are invisible to the company until promoted to
-- 'active' on the first message.

alter table conversations
  drop constraint conversations_status_check,
  add constraint conversations_status_check
    check (status in ('active', 'archived', 'blocked', 'draft'));
