-- ============================================================================
-- Migration: document_signing
-- Description: Digital signature support for dual-party document signing
--              (CAdES via UAPKI). Creates document_signatures table to track
--              individual signatures per party (supplier / counterparty).
--              Adds aggregate signature_status column to documents.
-- Dependencies: 20260320000005_documents_system (documents, counterparties),
--               20260401000003_fix_anonymous_access_policies (is_anonymous_user)
-- ============================================================================


-- ############################################################################
-- PART 1: AGGREGATE SIGNATURE STATUS ON documents
-- ############################################################################

alter table documents
	add column if not exists signature_status text not null default 'unsigned';

comment on column documents.signature_status is
	'Aggregate digital signature status: unsigned | partially_signed | fully_signed';


-- ############################################################################
-- PART 2: TABLE — document_signatures
-- ############################################################################

create table if not exists document_signatures (
	id                   uuid        default gen_random_uuid() primary key,
	document_id          uuid        not null references documents (id) on delete cascade,
	signer_role          text        not null
	                                 constraint chk_document_signatures_role
	                                 check (signer_role in ('supplier', 'counterparty')),
	signed_by            uuid        references users (id) on delete set null,
	signed_at            timestamptz not null default now(),
	signature_url        text        not null,
	signer_cn            text,
	signer_org           text,
	signature_algorithm  text,
	created_at           timestamptz not null default now(),

	constraint document_signatures_document_role_unique
		unique (document_id, signer_role)
);

comment on table  document_signatures                       is 'Individual digital signatures per document party (CAdES detached .p7s)';
comment on column document_signatures.document_id           is 'Parent document being signed';
comment on column document_signatures.signer_role           is 'Which party signed: supplier (company) or counterparty (customer)';
comment on column document_signatures.signed_by             is 'Platform user who performed the signing';
comment on column document_signatures.signed_at             is 'Timestamp when the digital signature was created';
comment on column document_signatures.signature_url         is 'Supabase Storage path to the .p7s detached CAdES signature file';
comment on column document_signatures.signer_cn             is 'Common Name from the signer certificate';
comment on column document_signatures.signer_org            is 'Organization from the signer certificate';
comment on column document_signatures.signature_algorithm   is 'Signature algorithm OID (DSTU4145, RSA, ECDSA)';


-- ############################################################################
-- PART 3: INDEXES
-- ############################################################################

create index idx_document_signatures_document_id
	on document_signatures (document_id);

create index idx_document_signatures_signed_by
	on document_signatures (signed_by)
	where signed_by is not null;


-- ############################################################################
-- PART 4: ROW LEVEL SECURITY
-- ############################################################################

alter table document_signatures enable row level security;
alter table document_signatures force row level security;

create policy "document_signatures: member select"
	on document_signatures
	for select
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1 from documents d
			where d.id = document_id
			  and d.deleted_at is null
			  and has_company_permission(d.company_id, 'documents:view', (select auth.uid()))
		)
	);

create policy "document_signatures: member insert"
	on document_signatures
	for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and exists (
			select 1 from documents d
			where d.id = document_id
			  and d.deleted_at is null
			  and has_company_permission(d.company_id, 'documents:edit', (select auth.uid()))
		)
	);

create policy "document_signatures: member delete"
	on document_signatures
	for delete
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1 from documents d
			where d.id = document_id
			  and d.deleted_at is null
			  and has_company_permission(d.company_id, 'documents:delete', (select auth.uid()))
		)
	);


-- ############################################################################
-- PART 5: HELPER — recompute aggregate signature_status
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

	update public.documents
	set signature_status = v_status
	where id = v_doc_id;

	return null;
end;
$$;

comment on function recompute_document_signature_status() is
	'Trigger function: keeps documents.signature_status in sync with document_signatures count';

create trigger trg_document_signatures_recompute_status
	after insert or delete on document_signatures
	for each row
	execute function recompute_document_signature_status();
