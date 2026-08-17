-- ============================================================================
-- Migration: fix_fully_signed_status
-- Description: Updates the recompute_document_signature_status trigger to also
--              set documents.status = 'signed' when signature_status becomes
--              'fully_signed'. Backfills existing documents stuck in 'sent'
--              status despite being fully signed.
-- Dependencies: 20260404000001_document_signing_columns
-- ============================================================================

-- ############################################################################
-- PART 1: FIX THE TRIGGER FUNCTION
-- ############################################################################

create or replace function recompute_document_signature_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_doc_id  uuid;
	v_count   int;
	v_status  text;
begin
	v_doc_id := coalesce(new.document_id, old.document_id);

	select count(*) into v_count
	from public.document_signatures
	where document_id = v_doc_id;

	case v_count
		when 0 then v_status := 'unsigned';
		when 1 then v_status := 'partially_signed';
		else        v_status := 'fully_signed';
	end case;

	if v_status = 'fully_signed' then
		update public.documents
		set signature_status = v_status,
		    status = 'signed'
		where id = v_doc_id
		  and status in ('sent', 'draft');
	else
		update public.documents
		set signature_status = v_status
		where id = v_doc_id;
	end if;

	return null;
end;
$$;

comment on function recompute_document_signature_status() is
	'Trigger function: keeps documents.signature_status in sync with document_signatures count. '
	'Also sets documents.status to signed when both parties have signed.';


-- ############################################################################
-- PART 2: BACKFILL — fix documents stuck in sent/draft with fully_signed
-- ############################################################################

update documents
set status = 'signed'
where signature_status = 'fully_signed'
  and status in ('sent', 'draft')
  and deleted_at is null;
