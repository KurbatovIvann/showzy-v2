-- ============================================================================
-- Migration: mono_acquiring_hardening
-- Description: Security and performance hardening for Monobank Acquiring:
--   1. Add FOR UPDATE row locking in webhook RPC to prevent race conditions
--   2. Add state transition validation matrix
--   3. Add composite partial index for order-based idempotency
-- Dependencies: mono_acquiring_invoices, process_mono_acquiring_webhook
-- ============================================================================

-- ############################################################################
-- PART 1: INDEX — composite partial index for idempotency check
-- ############################################################################

create index if not exists idx_mono_acq_invoices_order_active
	on mono_acquiring_invoices (order_id, company_id)
	where status in ('created', 'processing', 'hold');

-- ############################################################################
-- PART 2: FUNCTION — replace process_mono_acquiring_webhook with hardened version
-- ############################################################################

create or replace function process_mono_acquiring_webhook(
	p_mono_invoice_id text,
	p_status text,
	p_amount integer,
	p_payment_info jsonb default null,
	p_cancel_list jsonb default null,
	p_failure_reason text default null,
	p_err_code text default null,
	p_payment_method text default null
)
returns jsonb
security definer
set search_path = ''
language plpgsql
as $$
declare
	v_invoice record;
	v_old_status text;
	v_payment_id uuid;
	v_amount_decimal numeric(10, 2);
	v_payment_status_map jsonb := '{"failure": "failed", "reversed": "refunded", "expired": "cancelled"}'::jsonb;
	v_is_service_role boolean;
	v_valid_transitions jsonb := '{
		"created":    ["processing", "hold", "success", "failure", "expired"],
		"processing": ["hold", "success", "failure", "expired"],
		"hold":       ["success", "failure", "reversed", "expired"],
		"success":    ["reversed"],
		"failure":    [],
		"reversed":   [],
		"expired":    []
	}'::jsonb;
begin
	v_is_service_role := coalesce(
		current_setting('request.jwt.claims', true)::json->>'role',
		''
	) = 'service_role';

	if not v_is_service_role then
		raise exception 'Access denied: service_role required';
	end if;

	-- FOR UPDATE prevents concurrent webhook processing for the same invoice
	select id, company_id, order_id, payment_id, status, amount, payment_type
	into v_invoice
	from public.mono_acquiring_invoices
	where invoice_id = p_mono_invoice_id
	for update;

	if v_invoice is null then
		return jsonb_build_object('status', 'ignored', 'reason', 'invoice_not_found');
	end if;

	if v_invoice.status = p_status then
		return jsonb_build_object('status', 'already_processed');
	end if;

	-- Validate state transition
	if not (v_valid_transitions -> v_invoice.status) ? p_status then
		return jsonb_build_object(
			'status', 'ignored',
			'reason', 'invalid_transition',
			'from_status', v_invoice.status,
			'to_status', p_status
		);
	end if;

	v_old_status := v_invoice.status;

	-- Step 1: Update invoice record
	update public.mono_acquiring_invoices
	set
		status = p_status,
		payment_info = coalesce(p_payment_info, payment_info),
		cancel_list = coalesce(p_cancel_list, cancel_list),
		failure_reason = coalesce(p_failure_reason, failure_reason),
		err_code = coalesce(p_err_code, err_code),
		finalized_at = case
			when p_status = 'success' and payment_type = 'hold'
			then now()
			else finalized_at
		end
	where id = v_invoice.id;

	-- Step 2: Handle success — create/update payment + update order
	if p_status = 'success' and v_invoice.order_id is not null then
		v_amount_decimal := p_amount / 100.0;

		if v_invoice.payment_id is not null then
			update public.payments
			set
				status = 'completed',
				completed_at = now(),
				metadata = case
					when p_payment_info is not null
					then jsonb_build_object('monoPaymentInfo', p_payment_info)
					else metadata
				end
			where id = v_invoice.payment_id;

			v_payment_id := v_invoice.payment_id;
		else
			insert into public.payments (
				company_id, order_id, method, status, amount, currency,
				completed_at, metadata
			)
			values (
				v_invoice.company_id,
				v_invoice.order_id,
				'mono_acquiring',
				'completed',
				v_amount_decimal,
				'UAH',
				now(),
				case
					when p_payment_info is not null
					then jsonb_build_object('monoPaymentInfo', p_payment_info)
					else null
				end
			)
			returning id into v_payment_id;

			update public.mono_acquiring_invoices
			set payment_id = v_payment_id
			where id = v_invoice.id;
		end if;

		update public.orders
		set payment_status = 'paid', payment_method = 'mono_acquiring'
		where id = v_invoice.order_id
		  and payment_status <> 'paid';
	end if;

	-- Step 3: Handle failure/reversed/expired — update payment status
	if p_status in ('failure', 'reversed', 'expired') and v_invoice.payment_id is not null then
		update public.payments
		set status = (v_payment_status_map ->> p_status)
		where id = v_invoice.payment_id;
	end if;

	return jsonb_build_object(
		'status', 'processed',
		'invoice_id', v_invoice.id,
		'company_id', v_invoice.company_id,
		'order_id', v_invoice.order_id,
		'old_status', v_old_status,
		'new_status', p_status,
		'payment_id', v_payment_id
	);
end;
$$;

comment on function process_mono_acquiring_webhook(text, text, integer, jsonb, jsonb, text, text, text) is
	'Atomically processes a Monobank Acquiring webhook with row locking and state transition validation. Service role only.';

grant execute on function process_mono_acquiring_webhook(text, text, integer, jsonb, jsonb, text, text, text) to service_role;
