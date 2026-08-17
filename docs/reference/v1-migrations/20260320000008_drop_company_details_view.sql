-- ============================================================================
-- Migration: drop_company_details_view
-- Description: Remove the company_details view. Application code now queries
--              the companies table directly with PostgREST embeds for socials.
--              The get_company_page RPC is updated to join companies +
--              company_socials inline instead of reading from the view.
-- ============================================================================

-- ############################################################################
-- PART 1: Replace get_company_page to stop using company_details view
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
					co.id,
					co.name,
					co.slug,
					co.bio,
					co.about_html   as "aboutHtml",
					co.logo_url     as "logoUrl",
					co.city,
					co.area,
					co.address,
					co.phone,
					co.email,
					co.working_hours as "workingHours",
					co.reviews_enabled as "reviewsEnabled",
					co.latitude,
					co.longitude,
					co.products_count as "productsCount",
					co.followers_count as "followersCount",
					coalesce(
						(select jsonb_agg(
							jsonb_build_object('id', cs.id, 'platform', cs.platform, 'url', cs.url)
						) from public.company_socials cs
						where cs.company_id = co.id),
						'[]'::jsonb
					) as socials,
					coalesce(
						exists(
							select 1 from public.company_follows
							where company_id = v_company_id and user_id = v_user_id
						),
						false
					) as followed
				from public.companies co
				where co.id = v_company_id
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
-- PART 2: Drop the company_details view
-- ############################################################################

drop view if exists public.company_details;

-- ############################################################################
-- PART 3: Document tables accessed only via SQL functions/triggers
-- ############################################################################

comment on table public.company_subscriptions is
	'Subscription plans per company. Not queried directly by app code; accessed via SQL functions: has_feature(), get_company_features(), get_company_subscription(), and auto-assigned by the assign_free_plan_to_new_company() trigger.';

comment on table public.company_feature_overrides is
	'Per-company feature flag overrides. Not queried directly by app code; accessed via SQL functions: has_feature() and get_company_features().';

comment on table public.company_sku_sequences is
	'Auto-incrementing SKU sequence per company. Not queried directly by app code; maintained by the trg_auto_generate_sku() trigger on the products table.';

comment on table public.company_business_categories is
	'Junction table linking companies to business categories. Not queried directly by app code; used by the search_browse() SQL function for category filtering and aggregation.';
