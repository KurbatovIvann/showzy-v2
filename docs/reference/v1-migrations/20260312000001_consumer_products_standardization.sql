-- ============================================================================
-- Migration: consumer_products_standardization
-- Description: Extend consumer_products_view with unit types, physical specs,
--              and variant flag. Update all consumer RPCs to include new fields
--              and expose price source alongside resolved price.
-- Dependencies: consumer_products_view (20260301000019),
--               product_specifications_and_variants (20260311000001)
-- ============================================================================

-- ############################################################################
-- PART 1: EXTEND consumer_products_view
-- ############################################################################

create or replace view public.consumer_products_view
with (security_invoker = on)
as
select
	pr.id,
	pr.company_id,
	pr.name,
	pr.description,
	pr.price          as base_price,
	pr.hide_price,
	pc.name           as category,
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
	pr.fts,
	-- unit type
	ut.code           as unit_type_code,
	ut.name           as unit_type_name,
	ut.symbol         as unit_type_symbol,
	-- physical specs
	pr.weight_value,
	pr.weight_unit,
	pr.length_value,
	pr.width_value,
	pr.height_value,
	pr.dimension_unit,
	pr.volume_value,
	pr.volume_unit,
	-- inventory
	pr.stock_quantity,
	pr.track_inventory,
	-- variants
	exists(
		select 1 from public.product_variants pv
		where pv.product_id = pr.id and pv.is_active
	) as has_variants
from public.products pr
	join public.company_statuses cs on pr.status_id = cs.id
	left join public.product_categories pc on pr.category_id = pc.id
	left join public.unit_types ut on pr.unit_type_id = ut.id
where cs.code = 'active';

comment on view public.consumer_products_view is
	'Consumer-facing products with engagement data, unit types, physical specs, and variant flag. Single source of truth for all consumer product RPCs.';

-- ############################################################################
-- PART 2: UPDATE get_company_page — add new fields + priceSource
-- ############################################################################

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
					(pi.resolved ->> 'price')::numeric as price,
					pi.resolved ->> 'source'           as "priceSource",
					cpv.hide_price       as "hidePrice",
					cpv.category,
					cpv.updated_at       as "updatedAt",
					cpv.likes_count      as "likesCount",
					cpv.comments_count   as "commentsCount",
					cpv.liked,
					cpv.images,
					cpv.unit_type_code   as "unitTypeCode",
					cpv.unit_type_name   as "unitTypeName",
					cpv.unit_type_symbol as "unitTypeSymbol",
					cpv.weight_value     as "weightValue",
					cpv.weight_unit      as "weightUnit",
					cpv.length_value     as "lengthValue",
					cpv.width_value      as "widthValue",
					cpv.height_value     as "heightValue",
					cpv.dimension_unit   as "dimensionUnit",
					cpv.volume_value     as "volumeValue",
					cpv.volume_unit      as "volumeUnit",
				cpv.has_variants     as "hasVariants",
				cpv.stock_quantity   as "stockQuantity",
				cpv.track_inventory  as "trackInventory"
			from public.consumer_products_view cpv
			cross join lateral (
				select public.resolve_product_price(
					cpv.id, v_company_id, v_customer_id,
					v_customer_price_list_id, v_group_price_list_id,
					v_default_price_list_id, cpv.base_price
				) as resolved
			) pi
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
	'Returns all data for the company page: company detail (with followed state), products with resolved prices, engagement data, specs, and pagination cursor.';

-- ############################################################################
-- PART 3: UPDATE get_company_products — add new fields + priceSource
-- ############################################################################

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
			(pi.resolved ->> 'price')::numeric as price,
			pi.resolved ->> 'source'           as "priceSource",
			cpv.hide_price       as "hidePrice",
			cpv.category,
			cpv.updated_at       as "updatedAt",
			cpv.likes_count      as "likesCount",
			cpv.comments_count   as "commentsCount",
			cpv.liked,
			cpv.images,
			cpv.unit_type_code   as "unitTypeCode",
			cpv.unit_type_name   as "unitTypeName",
			cpv.unit_type_symbol as "unitTypeSymbol",
			cpv.weight_value     as "weightValue",
			cpv.weight_unit      as "weightUnit",
			cpv.length_value     as "lengthValue",
			cpv.width_value      as "widthValue",
			cpv.height_value     as "heightValue",
			cpv.dimension_unit   as "dimensionUnit",
			cpv.volume_value     as "volumeValue",
			cpv.volume_unit      as "volumeUnit",
			cpv.has_variants     as "hasVariants",
			cpv.stock_quantity   as "stockQuantity",
			cpv.track_inventory  as "trackInventory"
		from public.consumer_products_view cpv
		cross join lateral (
			select public.resolve_product_price(
				cpv.id, p_company_id, v_customer_id,
				v_customer_price_list_id, v_group_price_list_id,
				v_default_price_list_id, cpv.base_price
			) as resolved
		) pi
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
	'Paginated company products with resolved prices, engagement data, specs, and variant flag. Supports category filter and FTS search.';

-- ############################################################################
-- PART 4: UPDATE get_products_by_ids — add new fields + priceSource
-- ############################################################################

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
				(pi.resolved ->> 'price')::numeric as price,
				pi.resolved ->> 'source'           as "priceSource",
				cpv.hide_price       as "hidePrice",
				cpv.category,
				cpv.updated_at       as "updatedAt",
				cpv.likes_count      as "likesCount",
				cpv.comments_count   as "commentsCount",
				cpv.liked,
				cpv.images,
				cpv.unit_type_code   as "unitTypeCode",
				cpv.unit_type_name   as "unitTypeName",
				cpv.unit_type_symbol as "unitTypeSymbol",
				cpv.weight_value     as "weightValue",
				cpv.weight_unit      as "weightUnit",
				cpv.length_value     as "lengthValue",
				cpv.width_value      as "widthValue",
				cpv.height_value     as "heightValue",
				cpv.dimension_unit   as "dimensionUnit",
				cpv.volume_value     as "volumeValue",
				cpv.volume_unit      as "volumeUnit",
				cpv.has_variants     as "hasVariants",
				cpv.stock_quantity   as "stockQuantity",
				cpv.track_inventory  as "trackInventory"
			from public.consumer_products_view cpv
			cross join lateral (
				select public.resolve_product_price(
					cpv.id, p_company_id, v_customer_id,
					v_customer_price_list_id, v_group_price_list_id,
					v_default_price_list_id, cpv.base_price
				) as resolved
			) pi
			where cpv.id = any(p_product_ids)
				and cpv.company_id = p_company_id
		) r
	);
end;
$$;

comment on function get_products_by_ids is
	'Fetch products by IDs with resolved prices, engagement data, specs, and variant flag. Used by chat product carousel and product detail.';
