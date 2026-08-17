-- ============================================================================
-- Migration: orders_count_and_browse_address
-- Description: Denormalize orders_count on companies table with trigger,
--              backfill existing counts, and update search_browse to return
--              address + orders_count for improved company card UX.
-- Dependencies: companies (003), orders (012), browse_search_storage (019)
-- ============================================================================

-- ############################################################################
-- PART 1: ADD orders_count COLUMN
-- ############################################################################

alter table public.companies
	add column if not exists orders_count int not null default 0;

comment on column public.companies.orders_count is
	'Trigger-maintained count of orders placed at this company';

-- ############################################################################
-- PART 2: TRIGGER FUNCTION
-- ############################################################################

create or replace function public.trg_update_orders_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		update public.companies
		set orders_count = orders_count + 1
		where id = new.company_id;
	elsif tg_op = 'DELETE' then
		update public.companies
		set orders_count = greatest(0, orders_count - 1)
		where id = old.company_id;
	elsif tg_op = 'UPDATE' then
		if old.company_id is distinct from new.company_id then
			update public.companies
			set orders_count = greatest(0, orders_count - 1)
			where id = old.company_id;
			update public.companies
			set orders_count = orders_count + 1
			where id = new.company_id;
		end if;
	end if;

	return coalesce(new, old);
end;
$$;

comment on function public.trg_update_orders_count() is
	'Maintains companies.orders_count — increments on order insert, decrements on delete, handles company_id reassignment';

create trigger trg_orders_count
	after insert or update of company_id or delete on public.orders
	for each row
	execute function public.trg_update_orders_count();

-- ############################################################################
-- PART 3: BACKFILL EXISTING COUNTS
-- ############################################################################

update public.companies c
set orders_count = sub.cnt
from (
	select company_id, count(*)::int as cnt
	from public.orders
	group by company_id
) sub
where c.id = sub.company_id
  and c.orders_count != sub.cnt;

-- ############################################################################
-- PART 4: UPDATE search_browse TO RETURN address + orders_count
-- ############################################################################
drop function search_browse(text,vector,text,text,uuid[],double precision,double precision,double precision,integer,text,double precision,uuid);

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
	address text,
	latitude double precision,
	longitude double precision,
	products_count bigint,
	followers_count bigint,
	orders_count bigint,
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
			c.address,
			c.latitude,
			c.longitude,
			c.fts,
			c.embedding,
			c.created_at,
			c.products_count as p_count,
			c.followers_count as f_count,
			c.orders_count as o_count
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
			b.address,
			b.latitude,
			b.longitude,
			b.created_at,
			b.p_count,
			b.f_count,
			b.o_count,
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
		r.address,
		r.latitude,
		r.longitude,
		r.p_count::bigint as products_count,
		r.f_count::bigint as followers_count,
		r.o_count::bigint as orders_count,
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
