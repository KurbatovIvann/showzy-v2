-- Fix: UPDATE policy on documents should require deleted_at is null
-- (matches the SELECT policy which already enforces this)
drop policy if exists "documents: member update" on documents;
create policy "documents: member update"
	on documents for update
	to authenticated
	using (
		not is_anonymous_user()
		and deleted_at is null
		and has_company_permission(company_id, 'documents:edit', (select auth.uid()))
	)
	with check (
		not is_anonymous_user()
		and has_company_permission(company_id, 'documents:edit', (select auth.uid()))
	);

-- Add missing composite index for signature_status filtering
create index concurrently if not exists idx_documents_company_signature_status
	on documents (company_id, signature_status)
	where deleted_at is null;
