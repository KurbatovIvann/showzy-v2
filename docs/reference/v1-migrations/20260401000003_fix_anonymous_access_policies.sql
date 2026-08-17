-- ============================================================================
-- Migration: fix_anonymous_access_policies
-- Description: Address Supabase advisor 0012_auth_allow_anonymous_sign_ins by
--              adding NOT is_anonymous_user() guard to all non-public policies.
--              Anonymous sign-ins are enabled intentionally for showcase/public
--              browsing. This migration hardens every write policy and
--              authenticated-only read policy to explicitly reject anonymous
--              sessions as a defense-in-depth measure.
--
-- Unaffected (by design):
--   - "public read" SELECT policies on storefront tables (products, companies,
--     product_categories, etc.) — anonymous users SHOULD browse the storefront.
--   - "service_role_only" USING(false) policies — already deny everything.
--   - Policies that already include NOT is_anonymous_user() (conversations:
--     insert, messages: insert, companies: authenticated insert, etc.).
--   - cron, realtime, storage, auth schema policies — handled separately.
--
-- Dependencies: security_hardening (20260401000001),
--               company_default_payment_delivery (20260401000002)
-- ============================================================================

BEGIN;

-- ############################################################################
-- PART 1: auth.users / public.users
-- ############################################################################

-- "users: select own" — originally no TO clause (PUBLIC); restrict to
-- authenticated and exclude anonymous.
drop policy if exists "users: select own" on users;
create policy "users: select own"
	on users for select
	to authenticated
	using (
		not is_anonymous_user()
		and (select auth.uid()) = id
	);

-- "users: update own"
drop policy if exists "users: update own" on users;
create policy "users: update own"
	on users for update
	to authenticated
	using (not is_anonymous_user() and (select auth.uid()) = id)
	with check (not is_anonymous_user() and (select auth.uid()) = id);

-- "users: delete own" — originally no TO clause
drop policy if exists "users: delete own" on users;
create policy "users: delete own"
	on users for delete
	to authenticated
	using (
		not is_anonymous_user()
		and (select auth.uid()) = id
	);

-- "users: company member reads customer"
drop policy if exists "users: company member reads customer" on users;
create policy "users: company member reads customer"
	on users for select
	to authenticated
	using (
		not is_anonymous_user()
		and is_customer_of_company_member(id)
	);


-- ############################################################################
-- PART 2: companies (write policies only)
-- ############################################################################

-- "companies: settings update" — originally no TO clause
drop policy if exists "companies: settings update" on companies;
create policy "companies: settings update"
	on companies for update
	to authenticated
	using (
		not is_anonymous_user()
		and has_company_permission(id, 'settings:general', (select auth.uid()))
	);

-- "companies: owner delete" — originally no TO clause
drop policy if exists "companies: owner delete" on companies;
create policy "companies: owner delete"
	on companies for delete
	to authenticated
	using (
		not is_anonymous_user()
		and is_company_owner(id, (select auth.uid()))
	);


-- ############################################################################
-- PART 3: company_members
-- ############################################################################

drop policy if exists "company_members: select" on company_members;
create policy "company_members: select"
	on company_members for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or has_company_permission(company_id, 'team:view', (select auth.uid()))
		)
	);

drop policy if exists "company_members: update" on company_members;
create policy "company_members: update"
	on company_members for update
	to authenticated
	using (
		not is_anonymous_user()
		and has_company_permission(company_id, 'team:manage', (select auth.uid()))
		and user_id != (select auth.uid())
		and role != 'owner'
	)
	with check (
		not is_anonymous_user()
		and has_company_permission(company_id, 'team:manage', (select auth.uid()))
	);

drop policy if exists "company_members: delete" on company_members;
create policy "company_members: delete"
	on company_members for delete
	to authenticated
	using (
		not is_anonymous_user()
		and has_company_permission(company_id, 'team:manage', (select auth.uid()))
		and user_id != (select auth.uid())
		and role != 'owner'
	);


-- ############################################################################
-- PART 4: status_system (company_statuses, status_transitions, status_automations)
-- ############################################################################

-- company_statuses
drop policy if exists "company_statuses: member insert" on company_statuses;
create policy "company_statuses: member insert"
	on company_statuses for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "company_statuses: member update" on company_statuses;
create policy "company_statuses: member update"
	on company_statuses for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "company_statuses: member delete" on company_statuses;
create policy "company_statuses: member delete"
	on company_statuses for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

-- status_transitions
drop policy if exists "status_transitions: member insert" on status_transitions;
create policy "status_transitions: member insert"
	on status_transitions for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "status_transitions: member update" on status_transitions;
create policy "status_transitions: member update"
	on status_transitions for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "status_transitions: member delete" on status_transitions;
create policy "status_transitions: member delete"
	on status_transitions for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

-- status_automations
drop policy if exists "status_automations: member select" on status_automations;
create policy "status_automations: member select"
	on status_automations for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "status_automations: member insert" on status_automations;
create policy "status_automations: member insert"
	on status_automations for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "status_automations: member update" on status_automations;
create policy "status_automations: member update"
	on status_automations for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "status_automations: member delete" on status_automations;
create policy "status_automations: member delete"
	on status_automations for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

-- status_auto_transitions
drop policy if exists "status_auto_transitions: member insert" on status_auto_transitions;
create policy "status_auto_transitions: member insert"
	on status_auto_transitions for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "status_auto_transitions: member update" on status_auto_transitions;
create policy "status_auto_transitions: member update"
	on status_auto_transitions for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));

drop policy if exists "status_auto_transitions: member delete" on status_auto_transitions;
create policy "status_auto_transitions: member delete"
	on status_auto_transitions for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:statuses', (select auth.uid())));


-- ############################################################################
-- PART 5: products ecosystem
-- ############################################################################

-- product_categories
drop policy if exists "product_categories: member insert" on product_categories;
create policy "product_categories: member insert"
	on product_categories for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'categories:manage', (select auth.uid())));

drop policy if exists "product_categories: member update" on product_categories;
create policy "product_categories: member update"
	on product_categories for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'categories:manage', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'categories:manage', (select auth.uid())));

drop policy if exists "product_categories: member delete" on product_categories;
create policy "product_categories: member delete"
	on product_categories for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'categories:manage', (select auth.uid())));

-- unit_types
drop policy if exists "unit_types: member select" on unit_types;
create policy "unit_types: member select"
	on unit_types for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:view', (select auth.uid())));

drop policy if exists "unit_types: member insert" on unit_types;
create policy "unit_types: member insert"
	on unit_types for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:units', (select auth.uid())));

drop policy if exists "unit_types: member update" on unit_types;
create policy "unit_types: member update"
	on unit_types for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:units', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:units', (select auth.uid())));

drop policy if exists "unit_types: member delete" on unit_types;
create policy "unit_types: member delete"
	on unit_types for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:units', (select auth.uid())));

-- products
drop policy if exists "products: member insert" on products;
create policy "products: member insert"
	on products for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:create', (select auth.uid())));

drop policy if exists "products: member update" on products;
create policy "products: member update"
	on products for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())));

drop policy if exists "products: member delete" on products;
create policy "products: member delete"
	on products for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:delete', (select auth.uid())));

-- product_images
drop policy if exists "product_images: member insert" on product_images;
create policy "product_images: member insert"
	on product_images for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())));

drop policy if exists "product_images: member update" on product_images;
create policy "product_images: member update"
	on product_images for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())));

drop policy if exists "product_images: member delete" on product_images;
create policy "product_images: member delete"
	on product_images for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())));

-- product_comments (write policies only)
drop policy if exists "product_comments: owner update" on product_comments;
create policy "product_comments: owner update"
	on product_comments for update
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()))
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "product_comments: delete" on product_comments;
create policy "product_comments: delete"
	on product_comments for delete
	to authenticated
	using (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or has_company_permission(company_id, 'products:delete', (select auth.uid()))
		)
	);

-- product_options
drop policy if exists "product_options: member insert" on product_options;
create policy "product_options: member insert"
	on product_options for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:create', (select auth.uid())));

drop policy if exists "product_options: member update" on product_options;
create policy "product_options: member update"
	on product_options for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())));

drop policy if exists "product_options: member delete" on product_options;
create policy "product_options: member delete"
	on product_options for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:delete', (select auth.uid())));

-- product_option_values
drop policy if exists "product_option_values: member insert" on product_option_values;
create policy "product_option_values: member insert"
	on product_option_values for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:create', (select auth.uid()))
		)
	);

drop policy if exists "product_option_values: member update" on product_option_values;
create policy "product_option_values: member update"
	on product_option_values for update
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:edit', (select auth.uid()))
		)
	)
	with check (
		not is_anonymous_user()
		and exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:edit', (select auth.uid()))
		)
	);

drop policy if exists "product_option_values: member delete" on product_option_values;
create policy "product_option_values: member delete"
	on product_option_values for delete
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1 from product_options po
			where po.id = option_id
			  and has_company_permission(po.company_id, 'products:delete', (select auth.uid()))
		)
	);

-- product_variants
drop policy if exists "product_variants: member insert" on product_variants;
create policy "product_variants: member insert"
	on product_variants for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:create', (select auth.uid())));

drop policy if exists "product_variants: member update" on product_variants;
create policy "product_variants: member update"
	on product_variants for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'products:edit', (select auth.uid())));

drop policy if exists "product_variants: member delete" on product_variants;
create policy "product_variants: member delete"
	on product_variants for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'products:delete', (select auth.uid())));

-- product_variant_options
drop policy if exists "product_variant_options: member insert" on product_variant_options;
create policy "product_variant_options: member insert"
	on product_variant_options for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and exists (select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:create', (select auth.uid())))
	);

drop policy if exists "product_variant_options: member update" on product_variant_options;
create policy "product_variant_options: member update"
	on product_variant_options for update
	to authenticated
	using (
		not is_anonymous_user()
		and exists (select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:edit', (select auth.uid())))
	)
	with check (
		not is_anonymous_user()
		and exists (select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:edit', (select auth.uid())))
	);

drop policy if exists "product_variant_options: member delete" on product_variant_options;
create policy "product_variant_options: member delete"
	on product_variant_options for delete
	to authenticated
	using (
		not is_anonymous_user()
		and exists (select 1 from product_variants pv
			where pv.id = variant_id
			  and has_company_permission(pv.company_id, 'products:delete', (select auth.uid())))
	);


-- ############################################################################
-- PART 6: social (product_likes, company_follows)
-- ############################################################################

drop policy if exists "product_likes: owner delete" on product_likes;
create policy "product_likes: owner delete"
	on product_likes for delete
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "company_follows: owner delete" on company_follows;
create policy "company_follows: owner delete"
	on company_follows for delete
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));


-- ############################################################################
-- PART 7: company_profile (company_socials, showcase_config, company_business_categories)
-- ############################################################################

-- company_socials
drop policy if exists "company_socials: member insert" on company_socials;
create policy "company_socials: member insert"
	on company_socials for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

drop policy if exists "company_socials: member update" on company_socials;
create policy "company_socials: member update"
	on company_socials for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

drop policy if exists "company_socials: member delete" on company_socials;
create policy "company_socials: member delete"
	on company_socials for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

-- showcase_config
drop policy if exists "showcase_config: member insert" on showcase_config;
create policy "showcase_config: member insert"
	on showcase_config for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

drop policy if exists "showcase_config: member update" on showcase_config;
create policy "showcase_config: member update"
	on showcase_config for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

drop policy if exists "showcase_config: member delete" on showcase_config;
create policy "showcase_config: member delete"
	on showcase_config for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

-- company_business_categories
drop policy if exists "company_business_categories: member insert" on company_business_categories;
create policy "company_business_categories: member insert"
	on company_business_categories for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));

drop policy if exists "company_business_categories: member delete" on company_business_categories;
create policy "company_business_categories: member delete"
	on company_business_categories for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'showcase:edit', (select auth.uid())));


-- ############################################################################
-- PART 8: carts & checkout (no guest checkout)
-- ############################################################################

-- carts — originally no TO clause
drop policy if exists "carts: user access" on carts;
create policy "carts: user access"
	on carts for all
	to authenticated
	using (not is_anonymous_user() and (select auth.uid()) = user_id)
	with check (not is_anonymous_user() and (select auth.uid()) = user_id);

-- cart_items — originally no TO clause
drop policy if exists "cart_items: user access" on cart_items;
create policy "cart_items: user access"
	on cart_items for all
	to authenticated
	using (
		not is_anonymous_user()
		and exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid()))
	)
	with check (
		not is_anonymous_user()
		and exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid()))
	);

-- checkout_sessions
drop policy if exists "checkout_sessions: user select own" on checkout_sessions;
create policy "checkout_sessions: user select own"
	on checkout_sessions for select
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "checkout_sessions: user insert" on checkout_sessions;
create policy "checkout_sessions: user insert"
	on checkout_sessions for insert
	to authenticated
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "checkout_sessions: user update own" on checkout_sessions;
create policy "checkout_sessions: user update own"
	on checkout_sessions for update
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()) and status = 'active')
	with check (not is_anonymous_user() and user_id = (select auth.uid()) and status in ('active', 'abandoned'));

-- user_checkout_preferences — originally no TO clause
drop policy if exists "user_checkout_preferences: user select" on user_checkout_preferences;
create policy "user_checkout_preferences: user select"
	on user_checkout_preferences for select
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "user_checkout_preferences: user insert" on user_checkout_preferences;
create policy "user_checkout_preferences: user insert"
	on user_checkout_preferences for insert
	to authenticated
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "user_checkout_preferences: user update" on user_checkout_preferences;
create policy "user_checkout_preferences: user update"
	on user_checkout_preferences for update
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()))
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "user_checkout_preferences: user delete" on user_checkout_preferences;
create policy "user_checkout_preferences: user delete"
	on user_checkout_preferences for delete
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));


-- ############################################################################
-- PART 9: orders
-- ############################################################################

drop policy if exists "orders: member and customer select" on orders;
create policy "orders: member and customer select"
	on orders for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'orders:view', (select auth.uid()))
			or exists (
				select 1 from company_customers cc
				where cc.id = orders.customer_id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

drop policy if exists "orders: member update" on orders;
create policy "orders: member update"
	on orders for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())));

drop policy if exists "orders: customer cancel own pending" on orders;
create policy "orders: customer cancel own pending"
	on orders for update
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1 from company_customers cc
			where cc.id = orders.customer_id
			  and cc.user_id = (select auth.uid())
		)
		and exists (
			select 1 from company_statuses cs
			where cs.id = orders.status_id
			  and cs.code = 'pending'
		)
		and payment_status = 'pending'
	)
	with check (
		payment_status = 'cancelled'
		and (
			status_id is null
			or exists (
				select 1 from company_statuses cs
				where cs.id = status_id
				  and cs.code = 'cancelled'
				  and cs.entity_type = 'order'
			)
		)
	);

-- order_items
drop policy if exists "order_items: select" on order_items;
create policy "order_items: select"
	on order_items for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'orders:view', (select auth.uid()))
			or exists (
				select 1 from orders o
				join company_customers cc on o.customer_id = cc.id
				where o.id = order_items.order_id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

drop policy if exists "order_items: member insert" on order_items;
create policy "order_items: member insert"
	on order_items for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())));

drop policy if exists "order_items: member update" on order_items;
create policy "order_items: member update"
	on order_items for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())));

drop policy if exists "order_items: member delete" on order_items;
create policy "order_items: member delete"
	on order_items for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())));

-- order_logs
drop policy if exists "order_logs: select" on order_logs;
create policy "order_logs: select"
	on order_logs for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'orders:view', (select auth.uid()))
			or exists (
				select 1 from orders o
				join company_customers cc on cc.id = o.customer_id
				where o.id = order_logs.order_id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

-- order_deliveries
drop policy if exists "order_deliveries: select" on order_deliveries;
create policy "order_deliveries: select"
	on order_deliveries for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'orders:view', (select auth.uid()))
			or exists (
				select 1 from orders o
				join company_customers cc on cc.id = o.customer_id
				where o.id = order_deliveries.order_id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

drop policy if exists "order_deliveries: member insert" on order_deliveries;
create policy "order_deliveries: member insert"
	on order_deliveries for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())));

drop policy if exists "order_deliveries: member update" on order_deliveries;
create policy "order_deliveries: member update"
	on order_deliveries for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())));

drop policy if exists "order_deliveries: member delete" on order_deliveries;
create policy "order_deliveries: member delete"
	on order_deliveries for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'orders:edit', (select auth.uid())));


-- ############################################################################
-- PART 10: payments
-- ############################################################################

-- payment_settings
drop policy if exists "payment_settings: member select" on payment_settings;
create policy "payment_settings: member select"
	on payment_settings for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "payment_settings: member insert" on payment_settings;
create policy "payment_settings: member insert"
	on payment_settings for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "payment_settings: member update" on payment_settings;
create policy "payment_settings: member update"
	on payment_settings for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "payment_settings: member delete" on payment_settings;
create policy "payment_settings: member delete"
	on payment_settings for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

-- payments
drop policy if exists "payments: select" on payments;
create policy "payments: select"
	on payments for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'orders:view', (select auth.uid()))
			or exists (
				select 1 from orders o
				join company_customers cc on cc.id = o.customer_id
				where o.id = payments.order_id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

drop policy if exists "payments: member insert" on payments;
create policy "payments: member insert"
	on payments for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "payments: member update" on payments;
create policy "payments: member update"
	on payments for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));


-- ############################################################################
-- PART 11: delivery
-- ############################################################################

drop policy if exists "company_delivery_methods: authenticated select" on company_delivery_methods;
create policy "company_delivery_methods: authenticated select"
	on company_delivery_methods for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			is_enabled = true
			or has_company_permission(company_id, 'settings:delivery', (select auth.uid()))
		)
	);

drop policy if exists "company_delivery_methods: member insert" on company_delivery_methods;
create policy "company_delivery_methods: member insert"
	on company_delivery_methods for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:delivery', (select auth.uid())));

drop policy if exists "company_delivery_methods: member update" on company_delivery_methods;
create policy "company_delivery_methods: member update"
	on company_delivery_methods for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:delivery', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:delivery', (select auth.uid())));

drop policy if exists "company_delivery_methods: member delete" on company_delivery_methods;
create policy "company_delivery_methods: member delete"
	on company_delivery_methods for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:delivery', (select auth.uid())));


-- ############################################################################
-- PART 12: messaging
-- ############################################################################

-- conversations
drop policy if exists "conversations: select" on conversations;
create policy "conversations: select"
	on conversations for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			(customer_user_id is not null and customer_user_id = (select auth.uid()))
			or has_company_permission(company_id, 'chat:view', (select auth.uid()))
		)
	);

drop policy if exists "conversations: company member update" on conversations;
create policy "conversations: company member update"
	on conversations for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'chat:respond', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'chat:respond', (select auth.uid())));

-- messages
drop policy if exists "messages: select" on messages;
create policy "messages: select"
	on messages for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			exists (
				select 1 from conversations c
				where c.id = messages.conversation_id
				  and c.customer_user_id is not null
				  and c.customer_user_id = (select auth.uid())
			)
			or has_company_permission(company_id, 'chat:view', (select auth.uid()))
		)
	);

drop policy if exists "messages: sender update" on messages;
create policy "messages: sender update"
	on messages for update
	to authenticated
	using (not is_anonymous_user() and sender_user_id is not null and sender_user_id = (select auth.uid()))
	with check (not is_anonymous_user() and sender_user_id is not null and sender_user_id = (select auth.uid()));

-- conversation_participants
drop policy if exists "conversation_participants: select" on conversation_participants;
create policy "conversation_participants: select"
	on conversation_participants for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or exists (
				select 1 from conversation_participants cp
				where cp.conversation_id = conversation_participants.conversation_id
				  and cp.user_id = (select auth.uid())
			)
			or exists (
				select 1 from conversations c
				where c.id = conversation_participants.conversation_id
				  and has_company_permission(c.company_id, 'chat:view', (select auth.uid()))
			)
		)
	);

drop policy if exists "conversation_participants: self update" on conversation_participants;
create policy "conversation_participants: self update"
	on conversation_participants for update
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()))
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "conversation_participants: insert" on conversation_participants;
create policy "conversation_participants: insert"
	on conversation_participants for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or exists (
				select 1 from conversations c
				where c.id = conversation_participants.conversation_id
				  and has_company_permission(c.company_id, 'chat:respond', (select auth.uid()))
			)
		)
	);

-- message_mentions
drop policy if exists "message_mentions: select" on message_mentions;
create policy "message_mentions: select"
	on message_mentions for select
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1 from messages m
			join conversations c on c.id = m.conversation_id
			where m.id = message_mentions.message_id
			  and (
				  (c.customer_user_id is not null and c.customer_user_id = (select auth.uid()))
				  or has_company_permission(m.company_id, 'chat:view', (select auth.uid()))
			  )
		)
	);

drop policy if exists "message_mentions: sender insert" on message_mentions;
create policy "message_mentions: sender insert"
	on message_mentions for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and exists (
			select 1 from messages m
			where m.id = message_mentions.message_id
			  and (
				  m.sender_user_id = (select auth.uid())
				  or has_company_permission(m.company_id, 'chat:respond', (select auth.uid()))
			  )
		)
	);

-- message_reactions
drop policy if exists "message_reactions: select" on message_reactions;
create policy "message_reactions: select"
	on message_reactions for select
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1 from messages m
			join conversations c on c.id = m.conversation_id
			where m.id = message_reactions.message_id
			  and (
				(c.customer_user_id is not null and c.customer_user_id = (select auth.uid()))
				or has_company_permission(m.company_id, 'chat:view', (select auth.uid()))
			  )
		)
	);

drop policy if exists "message_reactions: insert" on message_reactions;
create policy "message_reactions: insert"
	on message_reactions for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and user_id = (select auth.uid())
		and exists (
			select 1 from messages m
			join conversations c on c.id = m.conversation_id
			where m.id = message_reactions.message_id
			  and (
				(c.customer_user_id is not null and c.customer_user_id = (select auth.uid()))
				or has_company_permission(m.company_id, 'chat:respond', (select auth.uid()))
			  )
		)
	);

drop policy if exists "message_reactions: delete own" on message_reactions;
create policy "message_reactions: delete own"
	on message_reactions for delete
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

-- messaging_contacts
drop policy if exists "messaging_contacts: member select" on messaging_contacts;
create policy "messaging_contacts: member select"
	on messaging_contacts for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'chat:view', (select auth.uid())));

drop policy if exists "messaging_contacts: member insert" on messaging_contacts;
create policy "messaging_contacts: member insert"
	on messaging_contacts for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'chat:respond', (select auth.uid())));

drop policy if exists "messaging_contacts: member update" on messaging_contacts;
create policy "messaging_contacts: member update"
	on messaging_contacts for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'chat:respond', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'chat:respond', (select auth.uid())));

drop policy if exists "messaging_contacts: member delete" on messaging_contacts;
create policy "messaging_contacts: member delete"
	on messaging_contacts for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'chat:respond', (select auth.uid())));


-- ############################################################################
-- PART 13: notifications & user_devices
-- ############################################################################

-- user_devices
drop policy if exists "user_devices: self select" on user_devices;
create policy "user_devices: self select"
	on user_devices for select
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "user_devices: self insert" on user_devices;
create policy "user_devices: self insert"
	on user_devices for insert
	to authenticated
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "user_devices: self update" on user_devices;
create policy "user_devices: self update"
	on user_devices for update
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()))
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "user_devices: self delete" on user_devices;
create policy "user_devices: self delete"
	on user_devices for delete
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

-- notifications
drop policy if exists "notifications: self select" on notifications;
create policy "notifications: self select"
	on notifications for select
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "notifications: self update" on notifications;
create policy "notifications: self update"
	on notifications for update
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()))
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "notifications: self delete" on notifications;
create policy "notifications: self delete"
	on notifications for delete
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));


-- ############################################################################
-- PART 14: integrations & bank_transactions
-- ############################################################################

-- company_integrations
drop policy if exists "company_integrations: member select" on company_integrations;
create policy "company_integrations: member select"
	on company_integrations for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'integrations:view', (select auth.uid())));

drop policy if exists "company_integrations: member insert" on company_integrations;
create policy "company_integrations: member insert"
	on company_integrations for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'integrations:manage', (select auth.uid())));

drop policy if exists "company_integrations: member update" on company_integrations;
create policy "company_integrations: member update"
	on company_integrations for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'integrations:manage', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'integrations:manage', (select auth.uid())));

drop policy if exists "company_integrations: member delete" on company_integrations;
create policy "company_integrations: member delete"
	on company_integrations for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'integrations:manage', (select auth.uid())));

-- bank_transactions
drop policy if exists "bank_transactions: member select" on bank_transactions;
create policy "bank_transactions: member select"
	on bank_transactions for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'transactions:view', (select auth.uid())));

drop policy if exists "bank_transactions: member insert" on bank_transactions;
create policy "bank_transactions: member insert"
	on bank_transactions for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'transactions:link', (select auth.uid())));

drop policy if exists "bank_transactions: member update" on bank_transactions;
create policy "bank_transactions: member update"
	on bank_transactions for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'transactions:link', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'transactions:link', (select auth.uid())));

drop policy if exists "bank_transactions: member delete" on bank_transactions;
create policy "bank_transactions: member delete"
	on bank_transactions for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'transactions:link', (select auth.uid())));


-- ############################################################################
-- PART 15: permissions (company_subscriptions, company_feature_overrides)
-- ############################################################################

drop policy if exists "company_subscriptions: member select" on company_subscriptions;
create policy "company_subscriptions: member select"
	on company_subscriptions for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:view', (select auth.uid())));

drop policy if exists "company_subscriptions: settings:payments update" on company_subscriptions;
create policy "company_subscriptions: settings:payments update"
	on company_subscriptions for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "company_feature_overrides: member select" on company_feature_overrides;
create policy "company_feature_overrides: member select"
	on company_feature_overrides for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:view', (select auth.uid())));

drop policy if exists "company_feature_overrides: settings:general insert" on company_feature_overrides;
create policy "company_feature_overrides: settings:general insert"
	on company_feature_overrides for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:general', (select auth.uid())));

drop policy if exists "company_feature_overrides: settings:general update" on company_feature_overrides;
create policy "company_feature_overrides: settings:general update"
	on company_feature_overrides for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:general', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:general', (select auth.uid())));

drop policy if exists "company_feature_overrides: settings:general delete" on company_feature_overrides;
create policy "company_feature_overrides: settings:general delete"
	on company_feature_overrides for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:general', (select auth.uid())));


-- ############################################################################
-- PART 16: customers & pricing
-- ############################################################################

-- customer_groups (write only; select was already fixed in security_hardening)
drop policy if exists "customer_groups: insert" on customer_groups;
create policy "customer_groups: insert"
	on customer_groups for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'customers:edit', (select auth.uid())));

drop policy if exists "customer_groups: update" on customer_groups;
create policy "customer_groups: update"
	on customer_groups for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'customers:edit', (select auth.uid())));

drop policy if exists "customer_groups: delete" on customer_groups;
create policy "customer_groups: delete"
	on customer_groups for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'customers:edit', (select auth.uid())));

-- Also harden the merged select from security_hardening
drop policy if exists "customer_groups: select" on customer_groups;
create policy "customer_groups: select"
	on customer_groups for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'customers:view', (select auth.uid()))
			or exists (
				select 1 from company_customers cc
				where cc.group_id = customer_groups.id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

-- company_customers
drop policy if exists "company_customers: select" on company_customers;
create policy "company_customers: select"
	on company_customers for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or has_company_permission(company_id, 'customers:view', (select auth.uid()))
		)
	);

drop policy if exists "company_customers: authenticated insert" on company_customers;
create policy "company_customers: authenticated insert"
	on company_customers for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or has_company_permission(company_id, 'customers:create', (select auth.uid()))
		)
	);

drop policy if exists "company_customers: update" on company_customers;
create policy "company_customers: update"
	on company_customers for update
	to authenticated
	using (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or has_company_permission(company_id, 'customers:edit', (select auth.uid()))
		)
	)
	with check (
		not is_anonymous_user()
		and (
			user_id = (select auth.uid())
			or has_company_permission(company_id, 'customers:edit', (select auth.uid()))
		)
	);

-- price_lists (write only; "authenticated read" is a legitimate read for customers)
drop policy if exists "price_lists: authenticated read" on price_lists;
create policy "price_lists: authenticated read"
	on price_lists for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
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
		)
	);

drop policy if exists "price_lists: member insert" on price_lists;
create policy "price_lists: member insert"
	on price_lists for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

drop policy if exists "price_lists: member update" on price_lists;
create policy "price_lists: member update"
	on price_lists for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

drop policy if exists "price_lists: member delete" on price_lists;
create policy "price_lists: member delete"
	on price_lists for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

-- price_list_items (write only)
drop policy if exists "price_list_items: member insert" on price_list_items;
create policy "price_list_items: member insert"
	on price_list_items for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

drop policy if exists "price_list_items: member update" on price_list_items;
create policy "price_list_items: member update"
	on price_list_items for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

drop policy if exists "price_list_items: member delete" on price_list_items;
create policy "price_list_items: member delete"
	on price_list_items for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

-- customer_product_prices
drop policy if exists "customer_product_prices: member and self read" on customer_product_prices;
create policy "customer_product_prices: member and self read"
	on customer_product_prices for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'price_lists:view', (select auth.uid()))
			or exists (
				select 1 from company_customers cc
				where cc.id = customer_product_prices.customer_id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

drop policy if exists "customer_product_prices: member insert" on customer_product_prices;
create policy "customer_product_prices: member insert"
	on customer_product_prices for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

drop policy if exists "customer_product_prices: member update" on customer_product_prices;
create policy "customer_product_prices: member update"
	on customer_product_prices for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

drop policy if exists "customer_product_prices: member delete" on customer_product_prices;
create policy "customer_product_prices: member delete"
	on customer_product_prices for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'price_lists:manage', (select auth.uid())));

-- company_customer_invites
drop policy if exists "company_customer_invites: member select" on company_customer_invites;
create policy "company_customer_invites: member select"
	on public.company_customer_invites for select
	to authenticated
	using (not is_anonymous_user() and public.has_company_permission(company_id, 'customers:view', (select auth.uid())));

drop policy if exists "company_customer_invites: member insert" on company_customer_invites;
create policy "company_customer_invites: member insert"
	on public.company_customer_invites for insert
	to authenticated
	with check (not is_anonymous_user() and public.has_company_permission(company_id, 'customers:invite', (select auth.uid())));

drop policy if exists "company_customer_invites: member update" on company_customer_invites;
create policy "company_customer_invites: member update"
	on public.company_customer_invites for update
	to authenticated
	using (not is_anonymous_user() and public.has_company_permission(company_id, 'customers:invite', (select auth.uid())))
	with check (not is_anonymous_user() and public.has_company_permission(company_id, 'customers:invite', (select auth.uid())));


-- ############################################################################
-- PART 17: mono_acquiring
-- ############################################################################

drop policy if exists "mono_acquiring_invoices: select" on mono_acquiring_invoices;
create policy "mono_acquiring_invoices: select"
	on mono_acquiring_invoices for select
	to authenticated
	using (
		not is_anonymous_user()
		and (
			has_company_permission(company_id, 'orders:view', (select auth.uid()))
			or exists (
				select 1 from orders o
				join company_customers cc on cc.id = o.customer_id
				where o.id = mono_acquiring_invoices.order_id
				  and cc.user_id = (select auth.uid())
			)
		)
	);

drop policy if exists "mono_acquiring_invoices: member insert" on mono_acquiring_invoices;
create policy "mono_acquiring_invoices: member insert"
	on mono_acquiring_invoices for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "mono_acquiring_invoices: member update" on mono_acquiring_invoices;
create policy "mono_acquiring_invoices: member update"
	on mono_acquiring_invoices for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));


-- ############################################################################
-- PART 18: company_legal_info
-- ############################################################################

drop policy if exists "company_legal_info: member select" on company_legal_info;
create policy "company_legal_info: member select"
	on company_legal_info for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "company_legal_info: member insert" on company_legal_info;
create policy "company_legal_info: member insert"
	on company_legal_info for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));

drop policy if exists "company_legal_info: member update" on company_legal_info;
create policy "company_legal_info: member update"
	on company_legal_info for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'settings:payments', (select auth.uid())));


-- ############################################################################
-- PART 19: customer_legal_info
-- ############################################################################

drop policy if exists "customer_legal_info: select own" on customer_legal_info;
create policy "customer_legal_info: select own"
	on customer_legal_info for select
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "customer_legal_info: insert own" on customer_legal_info;
create policy "customer_legal_info: insert own"
	on customer_legal_info for insert
	to authenticated
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "customer_legal_info: update own" on customer_legal_info;
create policy "customer_legal_info: update own"
	on customer_legal_info for update
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()))
	with check (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "customer_legal_info: delete own" on customer_legal_info;
create policy "customer_legal_info: delete own"
	on customer_legal_info for delete
	to authenticated
	using (not is_anonymous_user() and user_id = (select auth.uid()));

drop policy if exists "customer_legal_info: company member reads customer" on customer_legal_info;
create policy "customer_legal_info: company member reads customer"
	on customer_legal_info for select
	to authenticated
	using (not is_anonymous_user() and (select is_customer_of_company_member(user_id)));


-- ############################################################################
-- PART 20: documents
-- ############################################################################

-- counterparties
drop policy if exists "counterparties: member select" on counterparties;
create policy "counterparties: member select"
	on counterparties for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'counterparties:view', (select auth.uid())));

drop policy if exists "counterparties: member insert" on counterparties;
create policy "counterparties: member insert"
	on counterparties for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'counterparties:create', (select auth.uid())));

drop policy if exists "counterparties: member update" on counterparties;
create policy "counterparties: member update"
	on counterparties for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'counterparties:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'counterparties:edit', (select auth.uid())));

drop policy if exists "counterparties: member delete" on counterparties;
create policy "counterparties: member delete"
	on counterparties for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'counterparties:delete', (select auth.uid())));

-- document_templates
drop policy if exists "document_templates: member select" on document_templates;
create policy "document_templates: member select"
	on document_templates for select
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'documents:view', (select auth.uid())));

drop policy if exists "document_templates: member insert" on document_templates;
create policy "document_templates: member insert"
	on document_templates for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'documents:manage', (select auth.uid())));

drop policy if exists "document_templates: member update" on document_templates;
create policy "document_templates: member update"
	on document_templates for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'documents:manage', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'documents:manage', (select auth.uid())));

drop policy if exists "document_templates: member delete" on document_templates;
create policy "document_templates: member delete"
	on document_templates for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'documents:manage', (select auth.uid())));

-- default_document_templates (super-admin only)
drop policy if exists "default_document_templates: super-admin insert" on default_document_templates;
create policy "default_document_templates: super-admin insert"
	on default_document_templates for insert
	to authenticated
	with check (
		not is_anonymous_user()
		and (select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	);

drop policy if exists "default_document_templates: super-admin update" on default_document_templates;
create policy "default_document_templates: super-admin update"
	on default_document_templates for update
	to authenticated
	using (
		not is_anonymous_user()
		and (select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	)
	with check (
		not is_anonymous_user()
		and (select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	);

drop policy if exists "default_document_templates: super-admin delete" on default_document_templates;
create policy "default_document_templates: super-admin delete"
	on default_document_templates for delete
	to authenticated
	using (
		not is_anonymous_user()
		and (select (auth.jwt() -> 'app_metadata' ->> 'role')::text) = 'super-admin'
	);

-- documents
drop policy if exists "documents: member select" on documents;
create policy "documents: member select"
	on documents for select
	to authenticated
	using (
		not is_anonymous_user()
		and deleted_at is null
		and has_company_permission(company_id, 'documents:view', (select auth.uid()))
	);

drop policy if exists "documents: member insert" on documents;
create policy "documents: member insert"
	on documents for insert
	to authenticated
	with check (not is_anonymous_user() and has_company_permission(company_id, 'documents:create', (select auth.uid())));

drop policy if exists "documents: member update" on documents;
create policy "documents: member update"
	on documents for update
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'documents:edit', (select auth.uid())))
	with check (not is_anonymous_user() and has_company_permission(company_id, 'documents:edit', (select auth.uid())));

drop policy if exists "documents: member delete" on documents;
create policy "documents: member delete"
	on documents for delete
	to authenticated
	using (not is_anonymous_user() and has_company_permission(company_id, 'documents:delete', (select auth.uid())));

COMMIT;
