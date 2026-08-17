-- ============================================================================
-- Migration: assistant_search_functions
-- Depends on: customers_and_pricing (008), products (007), orders (012),
--             documents_system (020005), browse_search_storage (019),
--             assistant_search_products (20260410000001)
-- ============================================================================
-- 1. Adds FTS tsvector columns + trigram indexes to company_customers,
--    counterparties, and orders for typo-tolerant assistant search.
-- 2. Fixes assistant_search_products: similarity() -> word_similarity().
-- 3. Creates batch fuzzy search RPCs for customers, counterparties, orders.
--
-- All RPCs follow the same pattern:
--   - Accept (p_company_id, p_queries text[], p_limit_per_query)
--   - Return jsonb array of {query, matches} objects
--   - Use FTS + pg_trgm word_similarity + ILIKE for matching
--   - SECURITY DEFINER with manual company_id scoping
-- ============================================================================


-- ############################################################################
-- PART 1: FTS + TRIGRAM INFRASTRUCTURE
-- ############################################################################

-- ----------------------------------------------------------------------------
-- company_customers: fts column + indexes
-- ----------------------------------------------------------------------------

alter table public.company_customers
	add column if not exists fts tsvector generated always as (
		setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
		setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
		setweight(to_tsvector('simple', coalesce(email, '')), 'B')
	) stored;

create index if not exists idx_company_customers_fts
	on public.company_customers using gin (fts);

create index if not exists idx_company_customers_name_trgm
	on public.company_customers using gist (name extensions.gist_trgm_ops);

-- ----------------------------------------------------------------------------
-- counterparties: fts column + indexes
-- ----------------------------------------------------------------------------

alter table public.counterparties
	add column if not exists fts tsvector generated always as (
		setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
		setweight(to_tsvector('simple', coalesce(edrpou, '')), 'B') ||
		setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
		setweight(to_tsvector('simple', coalesce(email, '')), 'B')
	) stored;

create index if not exists idx_counterparties_fts
	on public.counterparties using gin (fts);

create index if not exists idx_counterparties_name_trgm
	on public.counterparties using gist (name extensions.gist_trgm_ops);

-- ----------------------------------------------------------------------------
-- orders: fts column + indexes
-- ----------------------------------------------------------------------------

alter table public.orders
	add column if not exists fts tsvector generated always as (
		setweight(to_tsvector('simple', coalesce(order_number, '')), 'A') ||
		setweight(to_tsvector('simple', coalesce(customer_name, '')), 'B') ||
		setweight(to_tsvector('simple', coalesce(customer_phone, '')), 'B') ||
		setweight(to_tsvector('simple', coalesce(customer_email, '')), 'B')
	) stored;

create index if not exists idx_orders_fts
	on public.orders using gin (fts);

create index if not exists idx_orders_customer_name_trgm
	on public.orders using gist (customer_name extensions.gist_trgm_ops);


-- ############################################################################
-- PART 2: FIX assistant_search_products (similarity -> word_similarity)
-- ############################################################################

create or replace function public.assistant_search_products(
	p_company_id      uuid,
	p_queries         text[],
	p_customer_id     uuid default null,
	p_limit_per_query int  default 5
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_customer_price_list_id uuid;
	v_group_price_list_id    uuid;
	v_default_price_list_id  uuid;
	v_result                 jsonb;
begin
	if p_queries is null or array_length(p_queries, 1) is null then
		return '[]'::jsonb;
	end if;

	if p_customer_id is not null then
		select cc.price_list_id, cg.price_list_id
		into v_customer_price_list_id, v_group_price_list_id
		from public.company_customers cc
		left join public.customer_groups cg on cg.id = cc.group_id
		where cc.id = p_customer_id
		  and cc.company_id = p_company_id;
	end if;

	select pl.id into v_default_price_list_id
	from public.price_lists pl
	where pl.company_id = p_company_id
	  and pl.is_default = true
	  and pl.is_active = true;

	select jsonb_agg(
		jsonb_build_object(
			'query', q.term,
			'matches', coalesce(q.matches, '[]'::jsonb)
		)
		order by q.idx
	)
	into v_result
	from (
		select
			terms.term,
			terms.idx,
			(
				select jsonb_agg(
					jsonb_build_object(
						'id',              r.id,
						'name',            r.name,
						'sku',             r.sku,
						'base_price',      r.base_price,
						'resolved_price',  r.resolved_price,
						'price_source',    r.price_source,
						'price_list_name', r.price_list_name,
						'stock_quantity',  r.stock_quantity,
						'track_inventory', r.track_inventory,
						'category_name',   r.category_name
					)
					order by r.rank desc
				)
				from (
					select
						p.id,
						p.name,
						p.sku,
						p.price as base_price,
						coalesce(
							cpp.price,
							cpli.price,
							gpli.price,
							dpli.price,
							p.price
						) as resolved_price,
						case
							when cpp.price  is not null then 'customer_override'
							when cpli.price is not null then 'customer_price_list'
							when gpli.price is not null then 'group_price_list'
							when dpli.price is not null then 'default_price_list'
							else 'base'
						end as price_source,
						case
							when cpp.price  is not null then null
							when cpli.price is not null then cpl.name
							when gpli.price is not null then gpl.name
							when dpli.price is not null then dpl.name
							else null
						end as price_list_name,
						p.stock_quantity,
						p.track_inventory,
						pc.name as category_name,
						ts_rank_cd(p.fts, plainto_tsquery('simple', terms.term)) * 2.0
							+ extensions.word_similarity(terms.term, p.name) as rank
					from public.products p
					left join public.company_statuses cs on cs.id = p.status_id
					left join public.product_categories pc on pc.id = p.category_id
					left join public.customer_product_prices cpp
						on  cpp.customer_id = p_customer_id
						and cpp.product_id  = p.id
						and p_customer_id is not null
					left join public.price_list_items cpli
						on  cpli.price_list_id = v_customer_price_list_id
						and cpli.product_id    = p.id
						and v_customer_price_list_id is not null
					left join public.price_lists cpl
						on  cpl.id = v_customer_price_list_id
						and cpli.price is not null
					left join public.price_list_items gpli
						on  gpli.price_list_id = v_group_price_list_id
						and gpli.product_id    = p.id
						and v_group_price_list_id is not null
					left join public.price_lists gpl
						on  gpl.id = v_group_price_list_id
						and gpli.price is not null
					left join public.price_list_items dpli
						on  dpli.price_list_id = v_default_price_list_id
						and dpli.product_id    = p.id
						and v_default_price_list_id is not null
					left join public.price_lists dpl
						on  dpl.id = v_default_price_list_id
						and dpli.price is not null
					where p.company_id = p_company_id
					  and (cs.code = 'active' or p.status_id is null)
					  and length(trim(terms.term)) > 0
					  and (
						p.fts @@ plainto_tsquery('simple', terms.term)
						or extensions.word_similarity(terms.term, p.name) > 0.25
						or p.name ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or p.sku ilike '%' || public.escape_like_pattern(terms.term) || '%'
					  )
					order by rank desc
					limit p_limit_per_query
				) r
			) as matches
		from unnest(p_queries) with ordinality as terms(term, idx)
	) q;

	return coalesce(v_result, '[]'::jsonb);
end;
$$;

comment on function public.assistant_search_products is
	'Batch fuzzy product search with customer-aware price resolution. '
	'Accepts an array of search terms and returns results grouped by query. '
	'Uses pg_trgm word_similarity + FTS + ILIKE for typo-tolerant matching. '
	'Resolves prices via 5-level hierarchy: customer override -> customer price list '
	'-> group price list -> default price list -> base price.';


-- ############################################################################
-- PART 3: assistant_search_customers
-- ############################################################################

create or replace function public.assistant_search_customers(
	p_company_id      uuid,
	p_queries         text[],
	p_limit_per_query int  default 5
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_result jsonb;
begin
	if p_queries is null or array_length(p_queries, 1) is null then
		return '[]'::jsonb;
	end if;

	select jsonb_agg(
		jsonb_build_object(
			'query', q.term,
			'matches', coalesce(q.matches, '[]'::jsonb)
		)
		order by q.idx
	)
	into v_result
	from (
		select
			terms.term,
			terms.idx,
			(
				select jsonb_agg(
					jsonb_build_object(
						'id',              r.id,
						'name',            r.name,
						'phone',           r.phone,
						'email',           r.email,
						'notes',           r.notes,
						'group_name',      r.group_name,
						'price_list_name', r.price_list_name,
						'created_at',      r.created_at
					)
					order by r.rank desc
				)
				from (
					select
						cc.id,
						cc.name,
						cc.phone,
						cc.email,
						cc.notes,
						cg.name  as group_name,
						pl.name  as price_list_name,
						cc.created_at,
						ts_rank_cd(cc.fts, plainto_tsquery('simple', terms.term)) * 2.0
							+ extensions.word_similarity(terms.term, cc.name) as rank
					from public.company_customers cc
					left join public.customer_groups cg on cg.id = cc.group_id
					left join public.price_lists pl     on pl.id = cc.price_list_id
					where cc.company_id = p_company_id
					  and length(trim(terms.term)) > 0
					  and (
						cc.fts @@ plainto_tsquery('simple', terms.term)
						or extensions.word_similarity(terms.term, cc.name) > 0.25
						or cc.name  ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or cc.phone ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or cc.email ilike '%' || public.escape_like_pattern(terms.term) || '%'
					  )
					order by rank desc
					limit p_limit_per_query
				) r
			) as matches
		from unnest(p_queries) with ordinality as terms(term, idx)
	) q;

	return coalesce(v_result, '[]'::jsonb);
end;
$$;

comment on function public.assistant_search_customers is
	'Batch fuzzy customer search. Accepts an array of search terms and returns '
	'results grouped by query. Uses pg_trgm word_similarity + FTS + ILIKE for '
	'typo-tolerant matching on name, phone, and email. Includes group and price '
	'list names for context.';

grant execute on function public.assistant_search_customers to authenticated;


-- ############################################################################
-- PART 4: assistant_search_counterparties
-- ############################################################################
-- Sensitive financial fields (edrpou, iban, bank_name, bank_mfo) are used
-- in the search predicate but excluded from the return shape to avoid
-- exposing PII/financial data to the AI model.

create or replace function public.assistant_search_counterparties(
	p_company_id      uuid,
	p_queries         text[],
	p_limit_per_query int  default 5
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_result jsonb;
begin
	if p_queries is null or array_length(p_queries, 1) is null then
		return '[]'::jsonb;
	end if;

	select jsonb_agg(
		jsonb_build_object(
			'query', q.term,
			'matches', coalesce(q.matches, '[]'::jsonb)
		)
		order by q.idx
	)
	into v_result
	from (
		select
			terms.term,
			terms.idx,
			(
				select jsonb_agg(
					jsonb_build_object(
						'id',            r.id,
						'name',          r.name,
						'phone',         r.phone,
						'email',         r.email,
						'notes',         r.notes,
						'legal_address', r.legal_address
					)
					order by r.rank desc
				)
				from (
					select
						cp.id,
						cp.name,
						cp.phone,
						cp.email,
						cp.notes,
						cp.legal_address,
						ts_rank_cd(cp.fts, plainto_tsquery('simple', terms.term)) * 2.0
							+ extensions.word_similarity(terms.term, cp.name) as rank
					from public.counterparties cp
					where cp.company_id = p_company_id
					  and length(trim(terms.term)) > 0
					  and (
						cp.fts @@ plainto_tsquery('simple', terms.term)
						or extensions.word_similarity(terms.term, cp.name) > 0.25
						or cp.name   ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or cp.edrpou ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or cp.phone  ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or cp.email  ilike '%' || public.escape_like_pattern(terms.term) || '%'
					  )
					order by rank desc
					limit p_limit_per_query
				) r
			) as matches
		from unnest(p_queries) with ordinality as terms(term, idx)
	) q;

	return coalesce(v_result, '[]'::jsonb);
end;
$$;

comment on function public.assistant_search_counterparties is
	'Batch fuzzy counterparty search. Accepts an array of search terms and returns '
	'results grouped by query. Searchable by name, EDRPOU, phone, email via '
	'pg_trgm word_similarity + FTS + ILIKE. Sensitive financial fields (EDRPOU, '
	'IBAN, bank details) are excluded from the return to prevent AI exposure.';

grant execute on function public.assistant_search_counterparties to authenticated;


-- ############################################################################
-- PART 5: assistant_search_orders
-- ############################################################################

create or replace function public.assistant_search_orders(
	p_company_id      uuid,
	p_queries         text[],
	p_limit_per_query int  default 5
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_result jsonb;
begin
	if p_queries is null or array_length(p_queries, 1) is null then
		return '[]'::jsonb;
	end if;

	select jsonb_agg(
		jsonb_build_object(
			'query', q.term,
			'matches', coalesce(q.matches, '[]'::jsonb)
		)
		order by q.idx
	)
	into v_result
	from (
		select
			terms.term,
			terms.idx,
			(
				select jsonb_agg(
					jsonb_build_object(
						'id',             r.id,
						'order_number',   r.order_number,
						'customer_name',  r.customer_name,
						'customer_phone', r.customer_phone,
						'customer_email', r.customer_email,
						'status_name',    r.status_name,
						'status_color',   r.status_color,
						'total_price',    r.total_price,
						'payment_status', r.payment_status,
						'payment_method', r.payment_method,
						'order_source',   r.order_source,
						'created_at',     r.created_at
					)
					order by r.rank desc
				)
				from (
					select
						o.id,
						o.order_number,
						o.customer_name,
						o.customer_phone,
						o.customer_email,
						cs.name  as status_name,
						cs.color as status_color,
						o.total_price,
						o.payment_status,
						o.payment_method,
						o.order_source,
						o.created_at,
						ts_rank_cd(o.fts, plainto_tsquery('simple', terms.term)) * 2.0
							+ coalesce(extensions.word_similarity(terms.term, o.customer_name), 0) as rank
					from public.orders o
					left join public.company_statuses cs on cs.id = o.status_id
					where o.company_id = p_company_id
					  and length(trim(terms.term)) > 0
					  and (
						o.fts @@ plainto_tsquery('simple', terms.term)
						or extensions.word_similarity(terms.term, coalesce(o.customer_name, '')) > 0.25
						or o.order_number   ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or o.customer_name  ilike '%' || public.escape_like_pattern(terms.term) || '%'
						or o.customer_phone ilike '%' || public.escape_like_pattern(terms.term) || '%'
					  )
					order by rank desc
					limit p_limit_per_query
				) r
			) as matches
		from unnest(p_queries) with ordinality as terms(term, idx)
	) q;

	return coalesce(v_result, '[]'::jsonb);
end;
$$;

comment on function public.assistant_search_orders is
	'Batch fuzzy order search. Accepts an array of search terms and returns '
	'results grouped by query. Searchable by order number, customer name, and '
	'customer phone via pg_trgm word_similarity + FTS + ILIKE. Joins '
	'company_statuses for human-readable status name and color.';

grant execute on function public.assistant_search_orders to authenticated;
