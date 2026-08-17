-- ============================================================================
-- Migration: resolve_product_prices_batch
-- Depends on: resolve_product_price (008), customer_product_prices (008),
--             price_list_items (008)
-- ============================================================================
-- Batch version of resolve_product_price. Resolves effective prices for
-- multiple products in a single query instead of N separate RPC calls.
-- Uses the same 5-level hierarchy:
--   1. Customer-specific override  (customer_product_prices)
--   2. Customer's assigned price list
--   3. Customer's group price list
--   4. Company default price list
--   5. Base product price (fallback)
-- ============================================================================

create or replace function resolve_product_prices_batch(
	p_product_ids              uuid[],
	p_base_prices              numeric[],
	p_company_id               uuid,
	p_customer_id              uuid,
	p_customer_price_list_id   uuid,
	p_group_price_list_id      uuid,
	p_default_price_list_id    uuid
) returns table(product_id uuid, price numeric, source text)
language plpgsql
stable
set search_path = ''
as $$
begin
	return query
	select
		u.product_id,
		coalesce(
			cpp.price,
			cpli.price,
			gpli.price,
			dpli.price,
			u.base_price
		) as price,
		case
			when cpp.price  is not null then 'customer_override'
			when cpli.price is not null then 'price_list'
			when gpli.price is not null then 'group_price_list'
			when dpli.price is not null then 'default_price_list'
			else 'base'
		end as source
	from unnest(p_product_ids, p_base_prices) as u(product_id, base_price)
	left join public.customer_product_prices cpp
		on  cpp.customer_id = p_customer_id
		and cpp.product_id  = u.product_id
		and p_customer_id is not null
	left join public.price_list_items cpli
		on  cpli.price_list_id = p_customer_price_list_id
		and cpli.product_id    = u.product_id
		and p_customer_price_list_id is not null
	left join public.price_list_items gpli
		on  gpli.price_list_id = p_group_price_list_id
		and gpli.product_id    = u.product_id
		and p_group_price_list_id is not null
	left join public.price_list_items dpli
		on  dpli.price_list_id = p_default_price_list_id
		and dpli.product_id    = u.product_id
		and p_default_price_list_id is not null;
end;
$$;

comment on function resolve_product_prices_batch is
	'Batch version of resolve_product_price. Resolves effective prices for '
	'multiple products in a single query using the same 5-level hierarchy: '
	'customer override -> customer price list -> group price list -> '
	'default price list -> base price.';

grant execute on function resolve_product_prices_batch to authenticated;
