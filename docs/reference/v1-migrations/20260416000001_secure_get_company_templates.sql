-- ============================================================================
-- Migration: 20260416000001_secure_get_company_templates
-- Description: Add caller authorization to get_company_templates RPC.
--              Verifies the caller is a member of the requested company
--              (or service_role) before returning template data.
-- ============================================================================
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Use the same pattern as next_document_number for consistency
  if coalesce(
       current_setting('request.jwt.claims', true)::json->>'role', ''
     ) <> 'service_role'
  then
    -- Use the permission system, not raw membership
    if not public.has_company_permission(p_company_id, 'documents:view')
    then
      raise exception 'Not a member of the requested company'
        using errcode = '42501';
    end if;
  end if;

  return query
    select ct.id, ct.type, ct.name, ct.content, ct.is_default, ct.description,
           'custom'::text as source, ct.created_at, ct.updated_at
    from public.document_templates ct
    where ct.company_id = p_company_id
      and (p_type is null or ct.type = p_type)

    union all

    select dt.id, dt.type, dt.name, dt.content, dt.is_default, dt.description,
           'system'::text as source, dt.created_at, dt.updated_at
    from public.default_document_templates dt
    where (p_type is null or dt.type = p_type)

    order by type, source desc, is_default desc, name;
end;
$$;

grant execute on function public.get_company_templates(uuid, text) to authenticated;