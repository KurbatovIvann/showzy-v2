-- ============================================================================
-- Migration: fix_customer_group_pricing_rls
-- Description: Fix three RLS policy gaps that prevent customers from seeing
--              prices resolved through their group's price list. The storefront
--              RPCs (get_company_page, get_company_products, get_products_by_ids)
--              run as security invoker, so resolve_product_price's queries hit
--              RLS. Without these changes, group price list lookups silently
--              return NULL and the customer sees base prices instead.
-- Dependencies: customers_and_pricing (008)
-- ============================================================================

-- ############################################################################
-- PART 1: customer_groups — allow customers to read their own group
-- ############################################################################
-- The existing SELECT policy requires has_company_permission('customers:view'),
-- which only company members have. A regular customer visiting the storefront
-- cannot read customer_groups, so the LEFT JOIN in get_company_page returns
-- NULL for cg.price_list_id.

create policy "customer_groups: customer self read"
	on customer_groups
	for select
	to authenticated
	using (
		exists (
			select 1 from company_customers cc
			where cc.group_id = customer_groups.id
			  and cc.user_id = (select auth.uid())
		)
	);

-- ############################################################################
-- PART 2: price_list_items — grant access to group price list items
-- ############################################################################
-- The existing policy checks cc.price_list_id (direct assignment) but not
-- the group's price list. resolve_product_price queries price_list_items
-- with the group_price_list_id, but RLS filters those rows out.

drop policy "price_list_items: member and public read" on price_list_items;

create policy "price_list_items: member and public read"
	on price_list_items
	for select
	to authenticated, anon
	using (
		has_company_permission(company_id, 'price_lists:view', (select auth.uid()))
		or exists (
			select 1 from company_customers cc
			where cc.price_list_id = price_list_items.price_list_id
			  and cc.user_id = (select auth.uid())
		)
		or exists (
			select 1 from company_customers cc
			join customer_groups cg on cg.id = cc.group_id
			where cg.price_list_id = price_list_items.price_list_id
			  and cc.user_id = (select auth.uid())
		)
		or exists (
			select 1 from price_lists pl
			where pl.id = price_list_items.price_list_id
			  and pl.is_default = true
			  and pl.is_active = true
		)
	);

-- ############################################################################
-- PART 3: price_lists — grant access to group price list
-- ############################################################################
-- Same gap: the customer can read their directly assigned price list and
-- defaults, but not their group's price list.

drop policy "price_lists: authenticated read" on price_lists;

create policy "price_lists: authenticated read"
	on price_lists
	for select
	to authenticated
	using (
		has_company_permission(company_id, 'price_lists:view', (select auth.uid()))
		or (is_default = true and is_active = true)
		or exists (
			select 1 from company_customers cc
			where cc.price_list_id = price_lists.id
			  and cc.user_id = (select auth.uid())
		)
		or exists (
			select 1 from company_customers cc
			join customer_groups cg on cg.id = cc.group_id
			where cg.price_list_id = price_lists.id
			  and cc.user_id = (select auth.uid())
		)
	);
