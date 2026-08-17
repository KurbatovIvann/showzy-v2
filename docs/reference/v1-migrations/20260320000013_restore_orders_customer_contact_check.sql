-- ============================================================================
-- Migration: restore_orders_customer_contact_check
-- Description: Restores the original orders_customer_contact_check: if
--              customer_name is set, at least one of customer_email or
--              customer_phone must be set. Link-user RPC fills contact from
--              public.users into company_customers for order snapshots.
-- Reverts: relaxed variant of the same constraint name if present.
-- ============================================================================

alter table public.orders
	drop constraint if exists orders_customer_contact_check;

alter table public.orders
	add constraint orders_customer_contact_check check (
		customer_name is null
		or (
			customer_email is not null
			or customer_phone is not null
		)
	);

comment on constraint orders_customer_contact_check on public.orders is
	'If customer_name is stored on the order, at least one of email or phone must be present.';
