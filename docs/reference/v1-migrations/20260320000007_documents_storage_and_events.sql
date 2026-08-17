-- ============================================================================
-- Migration: documents_storage_and_events
-- Description: Private storage bucket for generated PDF/DOCX documents with
--              unified read access policy, domain event outbox triggers for
--              documents (created, status_changed, pdf_ready), and order_log
--              enum extensions for document lifecycle events.
-- Consolidates: 20260325000001 + 20260326000003 + 20260326000005
--               + 20260328000003 + 20260328000004
-- Dependencies: documents (20260320000005), domain_events (20260309000002),
--               orders (20260301000012), has_company_permission
-- Path convention: {company_id}/{document_id}/{document_number}.{pdf|docx}
-- ============================================================================

-- ############################################################################
-- PART 1: STORAGE BUCKET
-- ############################################################################

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents-bucket', 'documents-bucket', false, 20971520);

-- ############################################################################
-- PART 2: SECURITY DEFINER HELPER FOR STORAGE ACCESS
-- ############################################################################

create or replace function public.can_read_document_object(
  p_company_id uuid,
  p_document_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  if public.has_company_permission(p_company_id, 'documents:view', v_user_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.documents d
      join public.orders o on o.id = d.order_id
      join public.company_customers cc on cc.id = o.customer_id
    where d.id = p_document_id
      and d.company_id = p_company_id
      and cc.user_id = v_user_id
  );
end;
$$;

comment on function public.can_read_document_object(uuid, uuid) is
  'SECURITY DEFINER helper for storage policies. Checks if the calling user '
  'can read a document object — either as a company member with documents:view '
  'or as the customer who owns the linked order. Bypasses table-level RLS so '
  'storage policies can reference documents/orders/company_customers.';

revoke execute on function public.can_read_document_object(uuid, uuid)
  from anon, public;
grant execute on function public.can_read_document_object(uuid, uuid)
  to authenticated;

-- ############################################################################
-- PART 3: UNIFIED STORAGE READ POLICY
-- ############################################################################

create policy "documents-bucket: authenticated read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents-bucket'
    and can_read_document_object(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

-- ############################################################################
-- PART 4: DOCUMENTS OUTBOX TRIGGER (all events)
-- ############################################################################

create or replace function fn_documents_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		insert into public.domain_events
			(event_type, aggregate_type, aggregate_id, company_id, payload)
		values (
			'document_created',
			'document',
			new.id,
			new.company_id,
			jsonb_build_object('new', row_to_json(new))
		);

	elsif tg_op = 'UPDATE' then
		if old.status is distinct from new.status then
			insert into public.domain_events
				(event_type, aggregate_type, aggregate_id, company_id, payload)
			values (
				'document_status_changed',
				'document',
				new.id,
				new.company_id,
				jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new))
			);
		end if;

		if old.pdf_url is null and new.pdf_url is not null then
			insert into public.domain_events
				(event_type, aggregate_type, aggregate_id, company_id, payload)
			values (
				'document_pdf_ready',
				'document',
				new.id,
				new.company_id,
				jsonb_build_object('new', row_to_json(new))
			);
		end if;
	end if;

	perform pg_notify('domain_events', 'documents');
	return new;
end;
$$;

create trigger trg_documents_outbox
	after insert or update on documents
	for each row execute function fn_documents_outbox();

-- ############################################################################
-- PART 5: ORDER LOG ENUM EXTENSIONS
-- ############################################################################

alter type order_log_action add value if not exists 'document_created';
alter type order_log_action add value if not exists 'document_status_changed';
