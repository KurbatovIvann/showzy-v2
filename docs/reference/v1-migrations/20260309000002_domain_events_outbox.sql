-- =============================================================================
-- Domain Events Outbox
-- Replaces Supabase Realtime subscriptions with guaranteed at-least-once delivery.
-- Triggers write events in the SAME transaction as the data change.
-- A poller service claims and processes events using FOR UPDATE SKIP LOCKED.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Outbox table
-- ---------------------------------------------------------------------------

create table if not exists domain_events (
	id             bigint       generated always as identity primary key,
	event_type     text         not null,
	aggregate_type text         not null,
	aggregate_id   uuid         not null,
	company_id     uuid,
	payload        jsonb        not null default '{}',
	created_at     timestamptz  not null default now(),
	processed_at   timestamptz,
	locked_until   timestamptz,
	locked_by      text,
	retry_count    int          not null default 0,
	max_retries    int          not null default 5,
	last_error     text
);

alter table domain_events enable row level security;

create index idx_domain_events_unprocessed
	on domain_events (id)
	where processed_at is null;

create index idx_domain_events_aggregate
	on domain_events (aggregate_type, aggregate_id, id);

create index idx_domain_events_processed_at
	on domain_events (processed_at)
	where processed_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Claim function (called via supabase.rpc)
--    Uses FOR UPDATE SKIP LOCKED for safe concurrent consumption.
-- ---------------------------------------------------------------------------

create or replace function claim_domain_events(
	p_batch_size int default 100,
	p_processor_id text default 'default'
)
returns setof public.domain_events
language plpgsql
security definer
set search_path = ''
as $$
begin
	return query
	with claimed as (
		select de.id
		from public.domain_events de
		where de.processed_at is null
			and (de.locked_until is null or de.locked_until < now())
			and de.retry_count < de.max_retries
		order by de.id
		limit p_batch_size
		for update skip locked
	)
	update public.domain_events de
	set locked_until = now() + interval '30 seconds',
	    locked_by    = p_processor_id
	from claimed
	where de.id = claimed.id
	returning de.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Retention cleanup
-- ---------------------------------------------------------------------------

create or replace function cleanup_processed_domain_events(
	retention_days int default 7
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
	deleted_count bigint;
begin
	delete from public.domain_events
	where processed_at is not null
		and processed_at < now() - make_interval(days => retention_days);
	get diagnostics deleted_count = row_count;
	return deleted_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Failure handler (called via supabase.rpc)
--    Atomically increments retry_count and releases the lock.
-- ---------------------------------------------------------------------------

create or replace function handle_domain_event_failure(
	p_event_id bigint,
	p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.domain_events
	set retry_count  = retry_count + 1,
	    last_error   = p_error,
	    locked_until = null,
	    locked_by    = null
	where id = p_event_id;
end;
$$;

-- ===========================================================================
-- TRIGGERS
-- Each trigger inserts into domain_events within the SAME transaction
-- as the data change, then fires pg_notify for optional fast wakeup.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 4a. Orders trigger
--     INSERT → order_created
--     UPDATE → status_changed (when status_id changes)
--     UPDATE → payment_changed (when payment_status changes)
-- ---------------------------------------------------------------------------

create or replace function fn_orders_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('order_created', 'order', new.id, new.company_id,
		        jsonb_build_object('new', row_to_json(new)));

	elsif tg_op = 'UPDATE' then
		if old.status_id is distinct from new.status_id then
			insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
			values ('status_changed', 'order', new.id, new.company_id,
			        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));
		end if;

		if old.payment_status is distinct from new.payment_status then
			insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
			values ('payment_changed', 'order', new.id, new.company_id,
			        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));
		end if;
	end if;

	perform pg_notify('domain_events', tg_table_name);
	return new;
end;
$$;

create trigger trg_orders_outbox
	after insert or update on orders
	for each row execute function fn_orders_outbox();

-- ---------------------------------------------------------------------------
-- 4b. Order items trigger
--     INSERT/UPDATE/DELETE → items_changed
--     The poller batches multiple item events per order.
-- ---------------------------------------------------------------------------

create or replace function fn_order_items_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_order_id   uuid;
	v_company_id uuid;
begin
	v_order_id   := coalesce(new.order_id, old.order_id);
	v_company_id := coalesce(new.company_id, old.company_id);

	insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
	values ('items_changed', 'order', v_order_id, v_company_id,
	        jsonb_build_object(
	            'op', tg_op,
	            'old', case when old is not null then row_to_json(old) else null end,
	            'new', case when new is not null then row_to_json(new) else null end
	        ));

	perform pg_notify('domain_events', 'order_items');
	return coalesce(new, old);
end;
$$;

create trigger trg_order_items_outbox
	after insert or update or delete on order_items
	for each row execute function fn_order_items_outbox();

-- ---------------------------------------------------------------------------
-- 4c. Order deliveries trigger
--     UPDATE → delivery_changed (only when status changes)
-- ---------------------------------------------------------------------------

create or replace function fn_order_deliveries_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'UPDATE' and old.status is distinct from new.status then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('delivery_changed', 'order', new.order_id, new.company_id,
		        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));

		perform pg_notify('domain_events', 'order_deliveries');
	end if;
	return new;
end;
$$;

create trigger trg_order_deliveries_outbox
	after update on order_deliveries
	for each row execute function fn_order_deliveries_outbox();

-- ---------------------------------------------------------------------------
-- 4d. Payments trigger
--     UPDATE → payment_confirmed (when status changes to 'completed')
--
--     NOTE: The previous Realtime service checked for status='confirmed',
--     but the DB constraint only allows 'completed'. Using 'completed' here
--     to match the actual DB values and fix the latent bug.
-- ---------------------------------------------------------------------------

create or replace function fn_payments_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'UPDATE'
		and new.status = 'completed'
		and old.status is distinct from new.status
	then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('payment_confirmed', 'payment', new.id, new.company_id,
		        jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new)));

		perform pg_notify('domain_events', 'payments');
	end if;
	return new;
end;
$$;

create trigger trg_payments_outbox
	after update on payments
	for each row execute function fn_payments_outbox();

-- ---------------------------------------------------------------------------
-- 4e. Products trigger
--     INSERT → product_created (all new products; active-check moved to processor)
-- ---------------------------------------------------------------------------

create or replace function fn_products_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('product_created', 'product', new.id, new.company_id,
		        jsonb_build_object('new', row_to_json(new)));

		perform pg_notify('domain_events', 'products');
	end if;
	return new;
end;
$$;

create trigger trg_products_outbox
	after insert on products
	for each row execute function fn_products_outbox();

-- ---------------------------------------------------------------------------
-- 4f. Company follows trigger
--     INSERT → company_followed
-- ---------------------------------------------------------------------------

create or replace function fn_company_follows_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		insert into public.domain_events (event_type, aggregate_type, aggregate_id, company_id, payload)
		values ('company_followed', 'company_follow', new.id, new.company_id,
		        jsonb_build_object('new', row_to_json(new)));

		perform pg_notify('domain_events', 'company_follows');
	end if;
	return new;
end;
$$;

create trigger trg_company_follows_outbox
	after insert on company_follows
	for each row execute function fn_company_follows_outbox();

-- ===========================================================================
-- 5. Remove Supabase Realtime subscriptions
--    These tables no longer need Realtime since the outbox handles CDC.
--    REPLICA IDENTITY FULL is only needed for Realtime's old/new tracking.
-- ===========================================================================

alter publication supabase_realtime drop table orders;
alter publication supabase_realtime drop table order_items;
alter publication supabase_realtime drop table order_deliveries;
alter publication supabase_realtime drop table payments;
alter publication supabase_realtime drop table products;
alter publication supabase_realtime drop table company_follows;

alter table orders replica identity default;
alter table order_items replica identity default;
alter table order_deliveries replica identity default;
