-- ============================================================================
-- Migration: documents_system
-- Description: Complete documents feature. Counterparties, document templates
--              (company + system defaults), documents with soft-delete, document
--              numbering (service-role aware), get_company_templates RPC,
--              'document' message content_type.
-- Consolidates: 20260324000001 + 20260325000002 + 20260326000004 (partial)
--               + 20260326000007
-- Dependencies: companies (003), users (004), company_members (005),
--               customers_and_pricing (008), orders (012),
--               messaging (20260301000015), core_functions (update_timestamp)
-- ============================================================================

-- ############################################################################
-- PART 1: TABLE — counterparties
-- ############################################################################

create table if not exists counterparties (
	id            uuid        default gen_random_uuid() primary key,
	company_id    uuid        not null references companies (id) on delete cascade,
	user_id       uuid        references users (id) on delete set null,
	customer_id   uuid        references company_customers (id) on delete set null,
	name          text        not null,
	edrpou        text,
	legal_address text,
	iban          text,
	bank_name     text,
	bank_mfo      text,
	phone         text,
	email         text,
	notes         text,
	created_at    timestamptz not null default now(),
	updated_at    timestamptz not null default now()
);

create unique index counterparties_company_edrpou_unique
	on counterparties (company_id, edrpou) where edrpou is not null;

comment on table  counterparties              is 'Company-scoped business partners (other FOPs) for document generation';
comment on column counterparties.user_id      is 'Optional link to a registered platform user';
comment on column counterparties.customer_id  is 'Optional link to existing company customer record';
comment on column counterparties.name         is 'Official FOP/entity name, e.g. "ФОП Іванов Іван Іванович"';
comment on column counterparties.edrpou       is 'ЄДРПОУ or ІПН tax identifier';
comment on column counterparties.legal_address is 'Legal/registration address';
comment on column counterparties.iban         is 'Bank account IBAN';
comment on column counterparties.bank_name    is 'Bank name';
comment on column counterparties.bank_mfo     is 'Bank MFO routing code (6 digits)';

-- ############################################################################
-- PART 2: TABLE — document_templates (company custom templates)
-- ############################################################################

create table if not exists document_templates (
	id          uuid        default gen_random_uuid() primary key,
	company_id  uuid        not null references companies (id) on delete cascade,
	type        text        not null
	                        constraint chk_document_templates_type
	                        check (type in ('agreement', 'delivery_note', 'payment_invoice', 'completion_act')),
	name        text        not null,
	content     jsonb,
	description text,
	is_default  boolean     default false,
	created_at  timestamptz not null default now(),
	updated_at  timestamptz not null default now()
);

create unique index document_templates_company_type_default_unique
	on document_templates (company_id, type) where is_default = true;

comment on table  document_templates             is 'Per-company customizable document templates';
comment on column document_templates.type        is 'Document type: agreement, delivery_note, payment_invoice, completion_act';
comment on column document_templates.content     is 'PlateJS (Slate) template JSON with variable placeholders';
comment on column document_templates.description is 'Human-readable template description';
comment on column document_templates.is_default  is 'Whether this is the default template for this type';

-- ############################################################################
-- PART 3: TABLE — default_document_templates (system-wide defaults)
-- ############################################################################

create table if not exists default_document_templates (
	id          uuid        default gen_random_uuid() primary key,
	type        text        not null
	                        constraint chk_default_document_templates_type
	                        check (type in ('agreement', 'delivery_note', 'payment_invoice', 'completion_act')),
	name        text        not null,
	content     jsonb       not null,
	description text,
	is_default  boolean     default true,
	created_at  timestamptz default now() not null,
	updated_at  timestamptz default now() not null
);

comment on table default_document_templates is 'System-wide default document templates managed by admins';

create unique index default_document_templates_type_default_unique
	on default_document_templates (type)
	where is_default = true;

-- ############################################################################
-- PART 4: TABLE — documents (with soft-delete from the start)
-- ############################################################################

create table if not exists documents (
	id                uuid          default gen_random_uuid() primary key,
	company_id        uuid          not null references companies (id) on delete cascade,
	template_id       uuid,
	template_source   text          not null default 'custom'
	                                constraint chk_documents_template_source
	                                check (template_source in ('system', 'custom')),
	template_name     text,
	type              text          not null
	                                constraint chk_documents_type
	                                check (type in ('agreement', 'delivery_note', 'payment_invoice', 'completion_act')),
	document_number   text          not null,
	order_id          uuid          references orders (id) on delete set null,
	counterparty_id   uuid          references counterparties (id) on delete set null,
	agreement_id      uuid          references documents (id) on delete set null,
	supplier_details  jsonb,
	buyer_details     jsonb,
	items             jsonb,
	total_amount      numeric(12, 2),
	currency          text          default 'UAH',
	notes             text,
	additional_terms  text,
	content           jsonb,
	status            text          not null default 'draft'
	                                constraint chk_documents_status
	                                check (status in ('draft', 'sent', 'signed', 'cancelled')),
	valid_from        date,
	valid_until       date,
	payment_due_date  date,
	signed_at         timestamptz,
	signed_by         uuid          references users (id) on delete set null,
	pdf_url           text,
	docx_url          text,
	created_by        uuid          references users (id) on delete set null,
	deleted_at        timestamptz,
	created_at        timestamptz   not null default now(),
	updated_at        timestamptz   not null default now(),

	constraint documents_company_type_number_unique unique (company_id, type, document_number)
);

comment on table  documents                     is 'Generated business documents (agreements, delivery notes, payment invoices, completion acts)';
comment on column documents.document_number     is 'Auto-generated sequential number: {prefix}-{type}-{year}/{seq}';
comment on column documents.template_source     is 'Whether the template is a system default or company custom';
comment on column documents.template_name       is 'Denormalized template name at creation time';
comment on column documents.agreement_id        is 'Optional link to a parent agreement document; used for delivery notes and completion acts';
comment on column documents.supplier_details    is 'Snapshot of company details at document creation time';
comment on column documents.buyer_details       is 'Snapshot of counterparty details at document creation time';
comment on column documents.items               is 'Array of line items: [{name, unit, qty, price, total}]';
comment on column documents.content             is 'PlateJS (Slate) document JSON array — the rendered document content';
comment on column documents.additional_terms    is 'Free-text additional terms for agreements';
comment on column documents.status              is 'Document lifecycle: draft, sent, signed, cancelled';
comment on column documents.valid_from          is 'Agreement validity start date';
comment on column documents.valid_until         is 'Agreement validity end date';
comment on column documents.payment_due_date    is 'Payment due date for invoices';
comment on column documents.signed_at           is 'Timestamp when document was marked as signed';
comment on column documents.pdf_url             is 'Storage path to generated PDF file';
comment on column documents.docx_url            is 'Storage path to generated DOCX file';
comment on column documents.deleted_at          is 'Soft-delete timestamp. NULL = active row.';

-- ############################################################################
-- PART 5: TABLE + FUNCTION — Document Number Counters
-- ############################################################################

create table if not exists document_number_counters (
	company_id  uuid   not null references companies (id) on delete cascade,
	type        text   not null,
	year        int    not null default extract(year from now()),
	last_number bigint not null default 0,
	primary key (company_id, type, year)
);

comment on table  document_number_counters             is 'Sequential document number counters per company, type, and year';
comment on column document_number_counters.last_number is 'Last assigned number for this company/type/year combination';

create or replace function next_document_number(p_company_id uuid, p_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_prefix      text;
	v_type_prefix text;
	v_year        int := extract(year from now());
	v_next_number bigint;
	v_is_service_role boolean;
begin
	v_is_service_role := coalesce(
		current_setting('request.jwt.claims', true)::json->>'role',
		''
	) = 'service_role';

	if not v_is_service_role
	   and not public.has_company_permission(p_company_id, 'documents:create')
	then
		raise exception 'Access denied: documents:create for company %', p_company_id;
	end if;

	select c.prefix into v_prefix
	from public.companies c
	where c.id = p_company_id;

	if v_prefix is null then
		raise exception 'Company not found: %', p_company_id;
	end if;

	case p_type
		when 'agreement'       then v_type_prefix := 'ДГ';
		when 'delivery_note'   then v_type_prefix := 'ВН';
		when 'payment_invoice' then v_type_prefix := 'РХ';
		when 'completion_act'  then v_type_prefix := 'АВ';
		else raise exception 'Unknown document type: %', p_type;
	end case;

	insert into public.document_number_counters (company_id, type, year, last_number)
	values (p_company_id, p_type, v_year, 1)
	on conflict (company_id, type, year)
	do update set last_number = public.document_number_counters.last_number + 1
	returning last_number into v_next_number;

	return v_prefix || '-' || v_type_prefix || '-' || v_year::text || '/' || lpad(v_next_number::text, 6, '0');
end;
$$;

comment on function next_document_number(uuid, text) is
	'Atomically generates the next sequential document number for a company/type/year. Format: PREFIX-TYPE-YYYY/NNNNNN. Bypasses permission check when called from service role.';

grant execute on function next_document_number(uuid, text) to authenticated;

create or replace function set_document_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.document_number is null then
		new.document_number := public.next_document_number(new.company_id, new.type);
	end if;
	return new;
end;
$$;

comment on function set_document_number() is
	'Auto-generates document_number on INSERT if not provided';

-- ############################################################################
-- PART 6: FUNCTION — get_company_templates
-- ############################################################################

create or replace function public.get_company_templates(
  p_company_id uuid,
  p_type       text default null
)
returns table (
  id          uuid,
  type        text,
  name        text,
  content     jsonb,
  is_default  boolean,
  description text,
  source      text,
  created_at  timestamptz,
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select ct.id, ct.type, ct.name, ct.content, ct.is_default, ct.description,
         'custom'::text as source, ct.created_at, ct.updated_at
  from public.document_templates ct
  where ct.company_id = p_company_id
    and (p_type is null or ct.type = p_type)

  union all

  select dt.id, dt.type, dt.name, dt.content, dt.is_default, dt.description,
         'system'::text as source, dt.created_at, dt.updated_at
  from public.default_document_templates dt
  where dt.is_default = true
    and (p_type is null or dt.type = p_type)

  order by type, source desc, is_default desc, name;
$$;

comment on function public.get_company_templates(uuid, text) is
  'Returns available templates for a company: custom overrides + system defaults. Used by document creation UI.';

grant execute on function public.get_company_templates(uuid, text) to authenticated;

-- ############################################################################
-- PART 7: INDEXES (all document indexes use deleted_at IS NULL)
-- ############################################################################

-- counterparties
create index idx_counterparties_company_id
	on counterparties (company_id);

create index idx_counterparties_user_id
	on counterparties (user_id)
	where user_id is not null;

create index idx_counterparties_customer_id
	on counterparties (customer_id)
	where customer_id is not null;

-- document_templates
create index idx_document_templates_company_type
	on document_templates (company_id, type);

-- documents — all filtered to active rows only
create index idx_documents_company_type
	on documents (company_id, type)
	where deleted_at is null;

create index idx_documents_order_id
	on documents (order_id)
	where order_id is not null;

create index idx_documents_counterparty_id
	on documents (counterparty_id)
	where counterparty_id is not null;

create index idx_documents_company_status
	on documents (company_id, status)
	where deleted_at is null;

create index idx_documents_template_id
	on documents (template_id)
	where template_id is not null;

create index idx_documents_signed_by
	on documents (signed_by)
	where signed_by is not null;

create index idx_documents_created_by
	on documents (created_by)
	where created_by is not null;

create index idx_documents_company_created_at
	on documents (company_id, created_at desc)
	where deleted_at is null;

create index idx_documents_has_content
	on documents (id)
	where content is not null;

create index idx_documents_agreement_id
	on documents (agreement_id)
	where agreement_id is not null;

create index idx_documents_order_id_active
	on documents (order_id)
	where deleted_at is null;

create index idx_documents_counterparty_id_active
	on documents (counterparty_id)
	where deleted_at is null;

-- ############################################################################
-- PART 8: ROW LEVEL SECURITY
-- ############################################################################

-- counterparties
alter table counterparties enable row level security;
alter table counterparties force row level security;

create policy "counterparties: member select"
	on counterparties
	for select
	to authenticated
	using (has_company_permission(company_id, 'counterparties:view', (select auth.uid())));

create policy "counterparties: member insert"
	on counterparties
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'counterparties:create', (select auth.uid())));

create policy "counterparties: member update"
	on counterparties
	for update
	to authenticated
	using (has_company_permission(company_id, 'counterparties:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'counterparties:edit', (select auth.uid())));

create policy "counterparties: member delete"
	on counterparties
	for delete
	to authenticated
	using (has_company_permission(company_id, 'counterparties:delete', (select auth.uid())));

-- document_templates
alter table document_templates enable row level security;
alter table document_templates force row level security;

create policy "document_templates: member select"
	on document_templates
	for select
	to authenticated
	using (has_company_permission(company_id, 'documents:view', (select auth.uid())));

create policy "document_templates: member insert"
	on document_templates
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'documents:manage', (select auth.uid())));

create policy "document_templates: member update"
	on document_templates
	for update
	to authenticated
	using (has_company_permission(company_id, 'documents:manage', (select auth.uid())))
	with check (has_company_permission(company_id, 'documents:manage', (select auth.uid())));

create policy "document_templates: member delete"
	on document_templates
	for delete
	to authenticated
	using (has_company_permission(company_id, 'documents:manage', (select auth.uid())));

-- default_document_templates
alter table default_document_templates enable row level security;
alter table default_document_templates force row level security;

create policy "default_document_templates: anyone select"
	on default_document_templates
	for select
	to authenticated
	using (true);

create policy "default_document_templates: super-admin insert"
	on default_document_templates
	for insert
	to authenticated
	with check (
		(select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	);

create policy "default_document_templates: super-admin update"
	on default_document_templates
	for update
	to authenticated
	using (
		(select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	)
	with check (
		(select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	);

create policy "default_document_templates: super-admin delete"
	on default_document_templates
	for delete
	to authenticated
	using (
		(select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	);

-- documents (SELECT filters out soft-deleted rows)
alter table documents enable row level security;
alter table documents force row level security;

create policy "documents: member select"
	on documents
	for select
	to authenticated
	using (
		deleted_at is null
		and has_company_permission(company_id, 'documents:view', (select auth.uid()))
	);

create policy "documents: member insert"
	on documents
	for insert
	to authenticated
	with check (has_company_permission(company_id, 'documents:create', (select auth.uid())));

create policy "documents: member update"
	on documents
	for update
	to authenticated
	using (has_company_permission(company_id, 'documents:edit', (select auth.uid())))
	with check (has_company_permission(company_id, 'documents:edit', (select auth.uid())));

create policy "documents: member delete"
	on documents
	for delete
	to authenticated
	using (has_company_permission(company_id, 'documents:delete', (select auth.uid())));

-- document_number_counters — no direct user access, only via function
alter table document_number_counters enable row level security;
alter table document_number_counters force row level security;

-- ############################################################################
-- PART 9: TRIGGERS
-- ############################################################################

create trigger counterparties_update_timestamp
	before update on counterparties
	for each row
	execute function update_timestamp();

create trigger document_templates_update_timestamp
	before update on document_templates
	for each row
	execute function update_timestamp();

create trigger set_default_document_templates_updated_at
	before update on default_document_templates
	for each row
	execute function update_timestamp();

create trigger documents_update_timestamp
	before update on documents
	for each row
	execute function update_timestamp();

create trigger assign_document_number
	before insert on documents
	for each row
	execute function set_document_number();

-- ############################################################################
-- PART 10: SOFT-DELETE TRIGGER
-- ############################################################################

create or replace function documents_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.documents
	set deleted_at = now()
	where id = old.id;

	return null;
end;
$$;

create trigger trg_documents_soft_delete
	before delete on documents
	for each row
	execute function documents_soft_delete();

-- ############################################################################
-- PART 11: SEED DATA — Permission Defaults
-- ############################################################################

insert into role_permission_defaults (role, permission) values
	('admin', 'counterparties:view'),
	('admin', 'counterparties:create'),
	('admin', 'counterparties:edit'),
	('admin', 'counterparties:delete'),
	('admin', 'documents:view'),
	('admin', 'documents:create'),
	('admin', 'documents:edit'),
	('admin', 'documents:delete'),
	('admin', 'documents:manage'),
	('manager', 'counterparties:view'),
	('manager', 'counterparties:create'),
	('manager', 'counterparties:edit'),
	('manager', 'documents:view'),
	('manager', 'documents:create'),
	('manager', 'documents:edit'),
	('employee', 'counterparties:view'),
	('employee', 'documents:view')
on conflict do nothing;

-- ############################################################################
-- PART 12: ALTER messages — add 'document' content_type
-- ############################################################################

alter table messages drop constraint if exists messages_content_type_check;
alter table messages add constraint messages_content_type_check
  check (content_type in ('text', 'image', 'file', 'audio', 'system', 'order', 'product', 'document'));

comment on column messages.content_type is
	'Type of content: text, image, file, audio, system, order, product, or document';
