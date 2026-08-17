-- ============================================================================
-- Migration: chat_attachments_storage
-- Description: Private storage bucket for chat file attachments (images,
--              videos, documents). Files are uploaded directly by clients
--              via RLS-enforced INSERT. Read access is restricted to
--              conversation participants. Signed URLs are generated
--              server-side by the API using the service role key.
-- Dependencies: conversations, is_company_member, has_company_permission
-- ============================================================================

-- ############################################################################
-- PART 1: BUCKET
-- ############################################################################

-- 50 MiB file size limit
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 52428800);

-- ############################################################################
-- PART 2: RLS POLICIES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Read: only conversation participants
-- Path convention: {companyId}/{conversationId}/{uuid}.{ext}
-- foldername(name)[1] = companyId, foldername(name)[2] = conversationId
-- Wraps auth.uid() in SELECT for RLS performance (called once, not per row).
-- ----------------------------------------------------------------------------

create policy "chat-attachments: participant read"
	on storage.objects
	for select
	to authenticated
	using (
		bucket_id = 'chat-attachments'
		and (
			exists (
				select 1
				from conversations c
				where c.id = (storage.foldername(name))[2]::uuid
				  and c.company_id = (storage.foldername(name))[1]::uuid
				  and c.customer_user_id is not null
				  and c.customer_user_id = (select auth.uid())
			)
			or has_company_permission(
				(storage.foldername(name))[1]::uuid,
				'chat:view',
				(select auth.uid())
			)
		)
	);

-- ----------------------------------------------------------------------------
-- Upload: conversation participant only
-- Customers can upload to their own conversations.
-- Company members with chat:respond permission can upload.
-- ----------------------------------------------------------------------------

create policy "chat-attachments: participant upload"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'chat-attachments'
		and (
			exists (
				select 1
				from conversations c
				where c.id = (storage.foldername(name))[2]::uuid
				  and c.company_id = (storage.foldername(name))[1]::uuid
				  and c.customer_user_id is not null
				  and c.customer_user_id = (select auth.uid())
			)
			or has_company_permission(
				(storage.foldername(name))[1]::uuid,
				'chat:respond',
				(select auth.uid())
			)
		)
	);
