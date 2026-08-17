-- ============================================================================
-- Fix anonymous access policies on storage schema
-- ============================================================================
-- cron schema policies (cron.job, cron.job_run_details) are false positives:
-- USING (username = CURRENT_USER) never matches API roles (anon/authenticated).
-- If you still want to silence the dashboard linter, run the cron section
-- manually in Dashboard > SQL Editor as superuser.
-- ============================================================================

BEGIN;

-- ############################################################################
-- storage.objects
-- ############################################################################
-- "storage: public read" is intentionally public for serving images — SKIP.
-- All other policies get NOT public.is_anonymous_user() added.

-- chat-attachments: participant read
drop policy if exists "chat-attachments: participant read" on storage.objects;
create policy "chat-attachments: participant read"
	on storage.objects for select
	to authenticated
	using (
		not public.is_anonymous_user()
		and bucket_id = 'chat-attachments'
		and (
			exists (
				select 1 from public.conversations c
				where c.id = (storage.foldername(objects.name))[2]::uuid
				  and c.company_id = (storage.foldername(objects.name))[1]::uuid
				  and c.customer_user_id is not null
				  and c.customer_user_id = (select auth.uid())
			)
			or public.has_company_permission(
				(storage.foldername(name))[1]::uuid,
				'chat:view',
				(select auth.uid())
			)
		)
	);

-- chat-attachments: participant upload
drop policy if exists "chat-attachments: participant upload" on storage.objects;
create policy "chat-attachments: participant upload"
	on storage.objects for insert
	to authenticated
	with check (
		not public.is_anonymous_user()
		and bucket_id = 'chat-attachments'
		and (
			exists (
				select 1 from public.conversations c
				where c.id = (storage.foldername(objects.name))[2]::uuid
				  and c.company_id = (storage.foldername(objects.name))[1]::uuid
				  and c.customer_user_id is not null
				  and c.customer_user_id = (select auth.uid())
			)
			or public.has_company_permission(
				(storage.foldername(name))[1]::uuid,
				'chat:respond',
				(select auth.uid())
			)
		)
	);

-- companies-bucket: member upload
drop policy if exists "companies-bucket: member upload" on storage.objects;
create policy "companies-bucket: member upload"
	on storage.objects for insert
	to authenticated
	with check (
		not public.is_anonymous_user()
		and bucket_id = 'companies-bucket'
		and public.is_company_member(
			(storage.foldername(name))[1]::uuid,
			(select auth.uid())
		)
	);

-- companies-bucket: member update
drop policy if exists "companies-bucket: member update" on storage.objects;
create policy "companies-bucket: member update"
	on storage.objects for update
	to authenticated
	using (
		not public.is_anonymous_user()
		and bucket_id = 'companies-bucket'
		and public.is_company_member(
			(storage.foldername(name))[1]::uuid,
			(select auth.uid())
		)
	);

-- companies-bucket: member delete
drop policy if exists "companies-bucket: member delete" on storage.objects;
create policy "companies-bucket: member delete"
	on storage.objects for delete
	to authenticated
	using (
		not public.is_anonymous_user()
		and bucket_id = 'companies-bucket'
		and public.is_company_member(
			(storage.foldername(name))[1]::uuid,
			(select auth.uid())
		)
	);

-- documents-bucket: authenticated read
drop policy if exists "documents-bucket: authenticated read" on storage.objects;
create policy "documents-bucket: authenticated read"
	on storage.objects for select
	to authenticated
	using (
		not public.is_anonymous_user()
		and bucket_id = 'documents-bucket'
		and public.can_read_document_object(
			(storage.foldername(name))[1]::uuid,
			(storage.foldername(name))[2]::uuid
		)
	);

-- users-bucket: self upload
drop policy if exists "users-bucket: self upload" on storage.objects;
create policy "users-bucket: self upload"
	on storage.objects for insert
	to authenticated
	with check (
		not public.is_anonymous_user()
		and bucket_id = 'users-bucket'
		and (storage.foldername(name))[1] = ((select auth.uid()))::text
	);

-- users-bucket: self update
drop policy if exists "users-bucket: self update" on storage.objects;
create policy "users-bucket: self update"
	on storage.objects for update
	to authenticated
	using (
		not public.is_anonymous_user()
		and bucket_id = 'users-bucket'
		and (storage.foldername(name))[1] = ((select auth.uid()))::text
	);

-- users-bucket: self delete
drop policy if exists "users-bucket: self delete" on storage.objects;
create policy "users-bucket: self delete"
	on storage.objects for delete
	to authenticated
	using (
		not public.is_anonymous_user()
		and bucket_id = 'users-bucket'
		and (storage.foldername(name))[1] = ((select auth.uid()))::text
	);

COMMIT;
