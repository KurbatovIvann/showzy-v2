-- ============================================================================
-- Migration: browse_search_storage
-- Description: Verifications table, storage bucket configuration, browse/search
--              functions (autocomplete, hybrid search, company page RPCs), and
--              default company data trigger (unit types, statuses, transitions).
-- Dependencies: companies (003), company_members (005), status_system (006),
--               products (007), company_profile (010), social (009),
--               core_functions (002), extensions (001)
-- Sources: 019 (storage_buckets), 022 (default_company_data),
--          054 (verifications), 072 (users_storage_bucket),
--          082 (browse_search_functions), 089 (search_browse),
--          095 (company_page_rpcs)
-- ============================================================================

-- ############################################################################
-- PART 1: TABLES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Table: verifications
-- OTP verification codes for phone (Turbosms) and email (Resend).
-- Service-role only access; no public/authenticated policies.
-- From 054.
-- ----------------------------------------------------------------------------

create table if not exists verifications (
	id          uuid        primary key default gen_random_uuid(),
	destination text        not null,
	type        text        not null default 'phone',
	code        text        not null,
	expires_at  timestamptz not null,
	verified_at timestamptz,
	attempts    int         default 0,
	created_at  timestamptz default now(),
	constraint max_attempts check (attempts <= 5),
	constraint valid_verification_type check (type in ('phone', 'email'))
);

-- ############################################################################
-- PART 2: INDEXES
-- ############################################################################

create index idx_verifications_destination_type_expires
	on verifications (destination, type, expires_at);

create index idx_verifications_created_at
	on verifications (created_at);

-- ############################################################################
-- PART 3: ROW LEVEL SECURITY
-- ############################################################################

alter table verifications enable row level security;
alter table verifications force row level security;

-- No policies: service_role bypasses RLS by default.
-- OTP verification is strictly backend/service_role only.

-- ############################################################################
-- PART 4: STORAGE BUCKETS AND POLICIES
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Buckets: companies-bucket (logos, product images) and users-bucket (avatars)
-- From 019 + 072.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('companies-bucket', 'companies-bucket', true);

insert into storage.buckets (id, name, public)
values ('users-bucket', 'users-bucket', true);

-- ----------------------------------------------------------------------------
-- Storage policies (from 019)
-- Bucket-scoped: read is limited to known buckets, writes require membership
-- or ownership of the folder path.
-- ----------------------------------------------------------------------------

create policy "storage: public read"
	on storage.objects
	for select
	using (bucket_id in ('companies-bucket', 'users-bucket'));

create policy "companies-bucket: member upload"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'companies-bucket'
		and is_company_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
	);

create policy "companies-bucket: member update"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'companies-bucket'
		and is_company_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
	);

create policy "companies-bucket: member delete"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'companies-bucket'
		and is_company_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
	);

create policy "users-bucket: self upload"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'users-bucket'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "users-bucket: self update"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'users-bucket'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "users-bucket: self delete"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'users-bucket'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

-- ############################################################################
-- PART 5: FUNCTIONS
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Function: escape_like_pattern (from 082)
-- Escapes LIKE/ILIKE special characters (% _ \) for safe pattern use.
-- IMMUTABLE, PARALLEL SAFE — suitable for use inside queries.
-- ----------------------------------------------------------------------------

create or replace function public.escape_like_pattern(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
	select replace(replace(replace(coalesce(p_text, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

comment on function public.escape_like_pattern is
	'Escape % _ \ for safe use in LIKE/ILIKE patterns';

-- ----------------------------------------------------------------------------
-- Function: search_suggestions (from 082)
-- Fast text-only autocomplete (no embedding, no geo).
-- Returns a mixed list of company and product suggestions.
-- SECURITY DEFINER. Improvement: search_path hardened from 'public','extensions'
-- to '' (all references already qualified).
-- ----------------------------------------------------------------------------

create or replace function search_suggestions(
	p_query text,
	p_limit int default 5
)
returns table (
	type text,
	id uuid,
	name text,
	subtitle text,
	image_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_query text := trim(coalesce(p_query, ''));
	v_half_limit int := greatest(p_limit / 2, 1);
begin
	if length(v_query) < 2 then
		return;
	end if;

	return query
	(
		select
			'company'::text as type,
			c.id,
			c.name,
			coalesce(c.city || coalesce(', ' || c.area, ''), c.area, '') as subtitle,
			c.logo_url as image_url
		from public.companies c
		where
			c.fts @@ plainto_tsquery('simple', v_query)
			or extensions.similarity(c.name, v_query) > 0.15
		order by
			ts_rank_cd(c.fts, plainto_tsquery('simple', v_query)) * 2.0
			+ extensions.similarity(c.name, v_query)
			desc
		limit v_half_limit
	)
	union all
	(
		select
			'product'::text as type,
			p.id,
			p.name,
			c.name as subtitle,
			(
				select pi.image_url
				from public.product_images pi
				where pi.product_id = p.id and pi.is_primary = true
				limit 1
			) as image_url
		from public.products p
		join public.companies c on c.id = p.company_id
		left join public.company_statuses cs on cs.id = p.status_id
		where
			(cs.code = 'active' or p.status_id is null)
			and (
				p.fts @@ plainto_tsquery('simple', v_query)
				or extensions.similarity(p.name, v_query) > 0.15
			)
		order by
			ts_rank_cd(p.fts, plainto_tsquery('simple', v_query)) * 2.0
			+ extensions.similarity(p.name, v_query)
			desc
		limit p_limit - v_half_limit
	);
end;
$$;

comment on function search_suggestions is
	'Fast text-only autocomplete returning mixed company/product suggestions';

-- ----------------------------------------------------------------------------
-- Function: search_browse (from 089)
-- Company-centric hybrid search with cursor-based pagination, denormalized
-- counts, cached tsquery, product_scores CTE, and top product previews.
-- SECURITY DEFINER. Improvement: search_path hardened from 'public','extensions'
-- to '' (all references already qualified).
-- ----------------------------------------------------------------------------

create or replace function search_browse(
	p_query text default null,
	p_embedding extensions.vector(1536) default null,
	p_city text default null,
	p_area text default null,
	p_category_ids uuid[] default null,
	p_user_lat double precision default null,
	p_user_lng double precision default null,
	p_radius_km double precision default null,
	p_limit int default 20,
	p_sort text default 'relevance',
	p_cursor_sort double precision default null,
	p_cursor_id uuid default null
)
returns table (
	id uuid,
	name text,
	slug text,
	logo_url text,
	bio text,
	city text,
	area text,
	latitude double precision,
	longitude double precision,
	products_count bigint,
	followers_count bigint,
	categories jsonb,
	score double precision,
	distance_km double precision,
	top_products jsonb,
	sort_value double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_has_query boolean := p_query is not null and length(trim(p_query)) > 0;
	v_has_embedding boolean := p_embedding is not null;
	v_has_geo boolean := p_user_lat is not null and p_user_lng is not null;
	v_has_cursor boolean := p_cursor_sort is not null and p_cursor_id is not null;
	v_radius double precision := coalesce(p_radius_km, 50.0);
	v_lat_delta double precision;
	v_lng_delta double precision;
	v_query text := trim(coalesce(p_query, ''));
	v_tsquery tsquery;
	v_city_pattern text;
	v_area_pattern text;
begin
	if v_has_geo then
		v_lat_delta := v_radius / 111.0;
		v_lng_delta := v_radius / greatest(111.0 * cos(radians(p_user_lat)), 0.01);
	end if;

	if v_has_query then
		v_tsquery := plainto_tsquery('simple', v_query);
	end if;

	if p_city is not null then
		v_city_pattern := '%' || public.escape_like_pattern(p_city) || '%';
	end if;
	if p_area is not null then
		v_area_pattern := '%' || public.escape_like_pattern(p_area) || '%';
	end if;

	return query
	with product_scores as (
		select
			p.company_id,
			max(
				(case when v_has_query then
					ts_rank_cd(p.fts, v_tsquery) * 2.0
					+ extensions.similarity(p.name, v_query)
				else 0 end) * 0.6
				+ (case when v_has_embedding and p.embedding is not null then
					greatest(1.0 - (p.embedding OPERATOR(extensions.<=>) p_embedding), 0)
				else 0 end) * 0.4
			) as best_score
		from public.products p
		left join public.company_statuses cs on cs.id = p.status_id
		where (cs.code = 'active' or p.status_id is null)
			and (
				(v_has_query and (
					p.fts @@ v_tsquery
					or extensions.similarity(p.name, v_query) > 0.1
				))
				or (v_has_embedding and p.embedding is not null
					and 1.0 - (p.embedding OPERATOR(extensions.<=>) p_embedding) > 0.3)
			)
		group by p.company_id
	),
	base as (
		select
			c.id,
			c.name,
			c.slug,
			c.logo_url,
			c.bio,
			c.city,
			c.area,
			c.latitude,
			c.longitude,
			c.fts,
			c.embedding,
			c.created_at,
			c.products_count as p_count,
			c.followers_count as f_count
		from public.companies c
		where
			(p_city is null or (v_city_pattern is not null and c.city ilike v_city_pattern))
			and (p_area is null or (v_area_pattern is not null and c.area ilike v_area_pattern))
			and (p_category_ids is null or exists (
				select 1 from public.company_business_categories cbc
				where cbc.company_id = c.id and cbc.category_id = any(p_category_ids)
			))
			and (
				not v_has_geo
				or (
					c.latitude is not null
					and c.longitude is not null
					and c.latitude between (p_user_lat - v_lat_delta) and (p_user_lat + v_lat_delta)
					and c.longitude between (p_user_lng - v_lng_delta) and (p_user_lng + v_lng_delta)
				)
			)
			and (
				(not v_has_query and not v_has_embedding)
				or (
					c.fts @@ v_tsquery
					or extensions.similarity(c.name, v_query) > 0.1
					or (v_has_embedding and c.embedding is not null and 1.0 - (c.embedding OPERATOR(extensions.<=>) p_embedding) > 0.3)
				)
				or exists (
					select 1 from product_scores ps where ps.company_id = c.id
				)
			)
	),
	scored as (
		select
			b.id,
			case when v_has_query then
				ts_rank_cd(b.fts, v_tsquery) * 2.0
				+ extensions.similarity(b.name, v_query)
			else 0 end as text_score,
			case when v_has_embedding and b.embedding is not null then
				greatest(1.0 - (b.embedding OPERATOR(extensions.<=>) p_embedding), 0)
			else 0 end as semantic_score,
			coalesce(ps.best_score, 0) as product_score
		from base b
		left join product_scores ps on ps.company_id = b.id
	),
	with_distance as (
		select
			s.*,
			b.name,
			b.slug,
			b.logo_url,
			b.bio,
			b.city,
			b.area,
			b.latitude,
			b.longitude,
			b.created_at,
			b.p_count,
			b.f_count,
			case when v_has_geo and b.latitude is not null and b.longitude is not null then
				public.haversine_km(p_user_lat, p_user_lng, b.latitude, b.longitude)
			else null end as dist_km
		from scored s
		join base b on b.id = s.id
	),
	ranked as (
		select
			wd.*,
			case p_sort
				when 'newest'  then extract(epoch from wd.created_at) * -1
				when 'popular' then wd.f_count::double precision * -1
				when 'nearest' then coalesce(wd.dist_km, 999999)
				else (greatest(wd.text_score * 0.6 + wd.semantic_score * 0.4, wd.product_score)) * -1
			end as sv
		from with_distance wd
		where
			not v_has_geo
			or wd.latitude is null
			or wd.dist_km <= v_radius
	),
	customer_ctx as (
		select
			cc.company_id,
			cc.id as customer_id,
			cc.price_list_id as customer_price_list_id,
			cg.price_list_id as group_price_list_id
		from public.company_customers cc
		left join public.customer_groups cg on cg.id = cc.group_id
		where cc.user_id = v_user_id
		  and cc.company_id in (select ranked.id from ranked)
	),
	default_pls as (
		select
			pl.company_id,
			pl.id as price_list_id
		from public.price_lists pl
		where pl.is_default = true
		  and pl.is_active = true
		  and pl.company_id in (select ranked.id from ranked)
	)
	select
		r.id,
		r.name,
		r.slug,
		r.logo_url,
		r.bio,
		r.city,
		r.area,
		r.latitude,
		r.longitude,
		r.p_count::bigint as products_count,
		r.f_count::bigint as followers_count,
		coalesce(
			(select jsonb_agg(jsonb_build_object(
				'id', bc.id, 'slug', bc.slug,
				'name_en', bc.name_en, 'name_uk', bc.name_uk
			))
			from public.company_business_categories cbc
			join public.business_categories bc on cbc.category_id = bc.id
			where cbc.company_id = r.id),
			'[]'::jsonb
		) as categories,
		(greatest(
			r.text_score * 0.6 + r.semantic_score * 0.4,
			r.product_score
		))::double precision as score,
		r.dist_km as distance_km,
		coalesce(tp.items, '[]'::jsonb) as top_products,
		r.sv as sort_value
	from ranked r
	left join customer_ctx ctx on ctx.company_id = r.id
	left join default_pls dpl on dpl.company_id = r.id
	left join lateral (
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', tp_row.id,
			'name', tp_row.name,
			'price', tp_row.price,
			'hide_price', tp_row.hide_price,
			'image_url', tp_row.image_url,
			'likes_count', tp_row.likes_count
		)), '[]'::jsonb) as items
		from (
			select
				p.id,
				p.name,
				(public.resolve_product_price(
					p.id, r.id, ctx.customer_id,
					ctx.customer_price_list_id, ctx.group_price_list_id,
					dpl.price_list_id, p.price
				) ->> 'price')::numeric as price,
				p.hide_price,
				pi.image_url,
				p.likes_count
			from public.products p
			left join public.company_statuses cs on cs.id = p.status_id
			left join public.product_images pi on pi.product_id = p.id and pi.is_primary = true
			where p.company_id = r.id
			  and (cs.code = 'active' or p.status_id is null)
			order by p.likes_count desc, p.created_at desc
			limit 3
		) tp_row
	) tp on true
	where
		not v_has_cursor
		or (r.sv, r.id) > (p_cursor_sort, p_cursor_id)
	order by r.sv asc, r.id asc
	limit p_limit;
end;
$$;

comment on function search_browse is
	'Company-centric hybrid search with cursor-based pagination and top product previews';

-- ############################################################################
-- PART 5A: CONSUMER PRODUCTS VIEW
-- Single source of truth for consumer-facing product data (images, engagement).
-- Security Invoker — RLS policies are respected, auth.uid() resolves to caller.
-- RPCs below select from this view and add only their unique logic
-- (price resolution, pagination, search).
-- ############################################################################

create or replace view public.consumer_products_view
with (security_invoker = on)
as
select
	pr.id,
	pr.company_id,
	pr.name,
	pr.description,
	pr.price        as base_price,
	pr.hide_price,
	pc.name         as category,
	pr.updated_at,
	pr.likes_count,
	(select count(*)
	 from public.product_comments pcc
	 where pcc.product_id = pr.id and pcc.parent_id is null
	)::int as comments_count,
	coalesce(
		(select auth.uid()) is not null
		and exists(
			select 1 from public.product_likes pl
			where pl.product_id = pr.id and pl.user_id = (select auth.uid())
		),
		false
	) as liked,
	coalesce((
		select json_agg(
			json_build_object(
				'imageUrl', pi.image_url,
				'displayOrder', pi.display_order,
				'isPrimary', pi.is_primary
			)
			order by pi.display_order
		)
		from public.product_images pi
		where pi.product_id = pr.id
	), '[]'::json) as images,
	pr.fts
from public.products pr
	join public.company_statuses cs on pr.status_id = cs.id
	left join public.product_categories pc on pr.category_id = pc.id
where cs.code = 'active';

comment on view public.consumer_products_view is
	'Consumer-facing products with engagement data (images, likes, comments, liked state). Single source of truth for all consumer product RPCs.';

-- ----------------------------------------------------------------------------
-- Function: get_company_page (from 095)
-- Returns everything needed to render the company page in a single call:
-- company (with followed), products (with images + liked), categories.
-- SECURITY INVOKER. Refactored to use consumer_products_view.
-- ----------------------------------------------------------------------------

create or replace function get_company_page(p_slug text, p_limit int default 20)
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
	v_company_id               uuid;
	v_user_id                  uuid := (select auth.uid());
	v_result                   json;
	v_last_cursor              timestamptz;
	v_customer_id              uuid;
	v_customer_price_list_id   uuid;
	v_group_price_list_id      uuid;
	v_default_price_list_id    uuid;
begin
	select id into v_company_id
	from public.companies
	where slug = p_slug;

	if v_company_id is null then
		return null;
	end if;

	select cc.id, cc.price_list_id, cg.price_list_id
	into v_customer_id, v_customer_price_list_id, v_group_price_list_id
	from public.company_customers cc
	left join public.customer_groups cg on cg.id = cc.group_id
	where cc.company_id = v_company_id and cc.user_id = v_user_id;

	select id into v_default_price_list_id
	from public.price_lists
	where company_id = v_company_id
	  and is_default = true
	  and is_active = true;

	select json_build_object(
		'company', (
			select row_to_json(c) from (
				select
					cd.id,
					cd.name,
					cd.slug,
					cd.bio,
					cd.about_html   as "aboutHtml",
					cd.logo_url     as "logoUrl",
					cd.city,
					cd.area,
					cd.address,
					cd.phone,
					cd.email,
					cd.working_hours as "workingHours",
					cd.reviews_enabled as "reviewsEnabled",
					cd.latitude,
					cd.longitude,
					cd.products_count as "productsCount",
					cd.followers_count as "followersCount",
					cd.socials,
					coalesce(
						exists(
							select 1 from public.company_follows
							where company_id = v_company_id and user_id = v_user_id
						),
						false
					) as followed
				from public.company_details cd
				where cd.id = v_company_id
			) c
		),
		'products', coalesce((
			select json_agg(row_to_json(p) order by p."updatedAt" desc) from (
				select
					cpv.id,
					cpv.name,
					cpv.description,
					(public.resolve_product_price(
						cpv.id, v_company_id, v_customer_id,
						v_customer_price_list_id, v_group_price_list_id,
						v_default_price_list_id, cpv.base_price
					) ->> 'price')::numeric as price,
					cpv.hide_price    as "hidePrice",
					cpv.category,
					cpv.updated_at    as "updatedAt",
					cpv.likes_count   as "likesCount",
					cpv.comments_count as "commentsCount",
					cpv.liked,
					cpv.images
				from public.consumer_products_view cpv
				where cpv.company_id = v_company_id
				order by cpv.updated_at desc
				limit p_limit
			) p
		), '[]'::json),
		'categories', coalesce((
			select json_agg(cat) from (
				select pc.id, pc.name
				from public.product_categories pc
				where pc.company_id = v_company_id
			) cat
		), '[]'::json)
	) into v_result;

	select (v_result -> 'products' -> (json_array_length(v_result -> 'products') - 1) ->> 'updatedAt')::timestamptz
	into v_last_cursor;

	if v_last_cursor is not null and json_array_length(v_result -> 'products') >= p_limit then
		v_result := v_result::jsonb || jsonb_build_object('nextCursor', v_last_cursor)::jsonb;
	end if;

	return v_result;
end;
$$;

comment on function get_company_page is
	'Returns all data for the mobile company page: company detail (with followed state), products with inline images and liked state, categories, and pagination cursor.';

-- ----------------------------------------------------------------------------
-- Function: get_company_products (from 095)
-- Paginated product loader with inline images and liked state.
-- Supports optional category filter and full-text search.
-- SECURITY INVOKER. Refactored to use consumer_products_view.
-- ----------------------------------------------------------------------------

create or replace function get_company_products(
	p_company_id uuid,
	p_cursor     timestamptz default null,
	p_category   text        default null,
	p_query      text        default null,
	p_limit      int         default 20
)
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
	v_user_id                  uuid := (select auth.uid());
	v_result                   json;
	v_has_query                boolean := p_query is not null and length(trim(p_query)) > 0;
	v_tsquery                  tsquery;
	v_products                 json;
	v_count                    int;
	v_last_cursor              timestamptz;
	v_customer_id              uuid;
	v_customer_price_list_id   uuid;
	v_group_price_list_id      uuid;
	v_default_price_list_id    uuid;
begin
	if v_has_query then
		v_tsquery := plainto_tsquery('simple', trim(p_query));
	end if;

	select cc.id, cc.price_list_id, cg.price_list_id
	into v_customer_id, v_customer_price_list_id, v_group_price_list_id
	from public.company_customers cc
	left join public.customer_groups cg on cg.id = cc.group_id
	where cc.company_id = p_company_id and cc.user_id = v_user_id;

	select id into v_default_price_list_id
	from public.price_lists
	where company_id = p_company_id
	  and is_default = true
	  and is_active = true;

	select coalesce(json_agg(row_to_json(r)), '[]'::json)
	into v_products
	from (
		select
			cpv.id,
			cpv.name,
			cpv.description,
			(public.resolve_product_price(
				cpv.id, p_company_id, v_customer_id,
				v_customer_price_list_id, v_group_price_list_id,
				v_default_price_list_id, cpv.base_price
			) ->> 'price')::numeric as price,
			cpv.hide_price    as "hidePrice",
			cpv.category,
			cpv.updated_at    as "updatedAt",
			cpv.likes_count   as "likesCount",
			cpv.comments_count as "commentsCount",
			cpv.liked,
			cpv.images
		from public.consumer_products_view cpv
		where cpv.company_id = p_company_id
			and (p_category is null or cpv.category = p_category)
			and (p_cursor is null or cpv.updated_at < p_cursor)
			and (
				not v_has_query
				or cpv.fts @@ v_tsquery
				or (length(trim(p_query)) <= 2 and cpv.name ilike '%' || trim(p_query) || '%')
			)
		order by
			case when v_has_query then ts_rank_cd(cpv.fts, v_tsquery) else 0 end desc,
			cpv.updated_at desc
		limit p_limit
	) r;

	v_count := json_array_length(v_products);

	if v_count > 0 and v_count >= p_limit then
		v_last_cursor := (v_products -> (v_count - 1) ->> 'updatedAt')::timestamptz;
		v_result := json_build_object('products', v_products, 'nextCursor', v_last_cursor);
	else
		v_result := json_build_object('products', v_products, 'nextCursor', null);
	end if;

	return v_result;
end;
$$;

comment on function get_company_products is
	'Paginated company products with inline images and liked state. Supports category filter and FTS search. Returns {products, nextCursor}.';

-- ----------------------------------------------------------------------------
-- Function: get_products_by_ids
-- Fetch specific products by IDs with full consumer data (engagement + price).
-- Used by the product carousel in chat to load live product data.
-- SECURITY INVOKER. Uses consumer_products_view.
-- ----------------------------------------------------------------------------

create or replace function public.get_products_by_ids(
	p_product_ids uuid[],
	p_company_id  uuid
)
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
	v_user_id                  uuid := (select auth.uid());
	v_customer_id              uuid;
	v_customer_price_list_id   uuid;
	v_group_price_list_id      uuid;
	v_default_price_list_id    uuid;
begin
	select cc.id, cc.price_list_id, cg.price_list_id
	into v_customer_id, v_customer_price_list_id, v_group_price_list_id
	from public.company_customers cc
	left join public.customer_groups cg on cg.id = cc.group_id
	where cc.company_id = p_company_id and cc.user_id = v_user_id;

	select id into v_default_price_list_id
	from public.price_lists
	where company_id = p_company_id
	  and is_default = true
	  and is_active = true;

	return (
		select coalesce(json_agg(row_to_json(r)), '[]'::json)
		from (
			select
				cpv.id,
				cpv.name,
				cpv.description,
				(public.resolve_product_price(
					cpv.id, p_company_id, v_customer_id,
					v_customer_price_list_id, v_group_price_list_id,
					v_default_price_list_id, cpv.base_price
				) ->> 'price')::numeric as price,
				cpv.hide_price    as "hidePrice",
				cpv.category,
				cpv.updated_at    as "updatedAt",
				cpv.likes_count   as "likesCount",
				cpv.comments_count as "commentsCount",
				cpv.liked,
				cpv.images
			from public.consumer_products_view cpv
			where cpv.id = any(p_product_ids)
				and cpv.company_id = p_company_id
		) r
	);
end;
$$;

comment on function get_products_by_ids is
	'Fetch products by IDs with consumer engagement data and resolved prices. Used by chat product carousel.';

-- ----------------------------------------------------------------------------
-- Function: create_default_company_data (from 022)
-- SECURITY DEFINER trigger function. Creates default unit types (7), product
-- statuses (from general_product template), order statuses (from general_order
-- template), and order status transitions when a new company is inserted.
-- Improvement: search_path hardened from 'public' to '' with qualified tables.
-- AI-related code (create_default_ai_settings) is excluded.
-- ----------------------------------------------------------------------------

create or replace function create_default_company_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_status_map jsonb := '{}';
	v_item record;
	v_transition record;
	v_new_status_id uuid;
begin
	insert into public.unit_types (company_id, code, name, symbol, is_default, sort_order)
	values
		(new.id, 'piece', 'Piece', 'pc', true, 1),
		(new.id, 'kg', 'Kilogram', 'kg', false, 2),
		(new.id, 'g', 'Gram', 'g', false, 3),
		(new.id, 'l', 'Liter', 'L', false, 4),
		(new.id, 'ml', 'Milliliter', 'ml', false, 5),
		(new.id, 'm', 'Meter', 'm', false, 6),
		(new.id, 'pack', 'Pack', 'pack', false, 7);

	for v_item in
		select sti.code, sti.name, sti.color, sti.icon, sti.sort_order, sti.is_default, sti.is_final
		from public.status_template_items sti
		join public.status_templates st on st.id = sti.template_id
		where st.code = 'general_product'
		order by sti.sort_order
	loop
		insert into public.company_statuses (company_id, entity_type, code, name, color, icon, sort_order, is_default, is_final)
		values (new.id, 'product', v_item.code, v_item.name, v_item.color, v_item.icon, v_item.sort_order, v_item.is_default, v_item.is_final);
	end loop;

	for v_item in
		select sti.code, sti.name, sti.color, sti.icon, sti.sort_order, sti.is_default, sti.is_final
		from public.status_template_items sti
		join public.status_templates st on st.id = sti.template_id
		where st.code = 'general_order'
		order by sti.sort_order
	loop
		insert into public.company_statuses (company_id, entity_type, code, name, color, icon, sort_order, is_default, is_final)
		values (new.id, 'order', v_item.code, v_item.name, v_item.color, v_item.icon, v_item.sort_order, v_item.is_default, v_item.is_final)
		returning id into v_new_status_id;

		v_status_map := v_status_map || jsonb_build_object(v_item.code, v_new_status_id);
	end loop;

	for v_transition in
		select stt.from_status_code, stt.to_status_code
		from public.status_template_transitions stt
		join public.status_templates st on st.id = stt.template_id
		where st.code = 'general_order'
	loop
		insert into public.status_transitions (company_id, from_status_id, to_status_id)
		values (
			new.id,
			(v_status_map ->> v_transition.from_status_code)::uuid,
			(v_status_map ->> v_transition.to_status_code)::uuid
		);
	end loop;

	return new;
end;
$$;

comment on function create_default_company_data() is
	'Creates default unit types, statuses, and transitions when a new company is created';

-- ############################################################################
-- PART 6: TRIGGERS
-- ############################################################################

create trigger create_default_company_trigger
	after insert on companies
	for each row
	execute function create_default_company_data();

-- ############################################################################
-- PART 7: GRANTS
-- ############################################################################

grant execute on function search_suggestions to anon, authenticated;
grant execute on function search_browse to anon, authenticated;
grant execute on function get_company_page to anon, authenticated;
grant execute on function get_company_products to anon, authenticated;
grant execute on function get_products_by_ids to anon, authenticated;
