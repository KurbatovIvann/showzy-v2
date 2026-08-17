-- ============================================================================
-- 021: Meta Data Deletion Requests
-- Track data deletion requests from Meta (Facebook/Instagram)
-- when users remove the Showzy app from their account.
-- ============================================================================

create table if not exists meta_data_deletion_requests (
    id                uuid        primary key default gen_random_uuid(),
    meta_user_id      text        not null,
    confirmation_code text        not null unique,
    status            text        not null default 'pending'
        check (status in ('pending', 'processing', 'completed')),
    created_at        timestamptz default now(),
    completed_at      timestamptz
);

create index idx_meta_data_deletion_meta_user_id
    on meta_data_deletion_requests (meta_user_id);

-- RLS: service_role only (webhook has no user context; service_role bypasses RLS by default)
alter table meta_data_deletion_requests enable row level security;
