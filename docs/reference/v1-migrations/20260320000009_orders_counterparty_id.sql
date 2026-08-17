-- =============================================================================
-- Migration: orders_counterparty_id
-- Description: Add counterparty_id FK to orders table, bridging the gap
--              between orders (customer_id -> company_customers) and the
--              documents system (counterparty_id -> counterparties).
--              Uses a BEFORE INSERT/UPDATE trigger to auto-resolve the
--              counterparty from the customer, so existing RPCs need no changes.
-- Dependencies: orders (20260301000012), counterparties (20260320000005),
--               company_customers (20260301000008)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add column + partial index
-- ---------------------------------------------------------------------------

alter table orders
  add column if not exists counterparty_id uuid
    references counterparties(id) on delete set null;

create index if not exists idx_orders_counterparty_id
  on orders(counterparty_id)
  where counterparty_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Trigger: auto-resolve counterparty from customer on INSERT / UPDATE
--    Looks up counterparties linked via customer_id or shared user_id.
-- ---------------------------------------------------------------------------

create or replace function fn_orders_resolve_counterparty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.counterparty_id is null and new.customer_id is not null then
    select cp.id into new.counterparty_id
    from public.counterparties cp
    left join public.company_customers cc on cc.id = new.customer_id
    where cp.company_id = new.company_id
      and (
        cp.customer_id = new.customer_id
        or (cc.user_id is not null and cp.user_id = cc.user_id)
      )
    limit 1;
  end if;
  return new;
end;
$$;

create trigger trg_orders_resolve_counterparty
  before insert or update of customer_id on orders
  for each row execute function fn_orders_resolve_counterparty();

-- ---------------------------------------------------------------------------
-- 3. Backfill existing orders
-- ---------------------------------------------------------------------------

update orders o
set counterparty_id = resolved.cp_id
from (
  select distinct on (o2.id) o2.id as order_id, cp.id as cp_id
  from orders o2
  join company_customers cc on cc.id = o2.customer_id
  join counterparties cp on cp.company_id = o2.company_id
    and (
      cp.customer_id = cc.id
      or (cc.user_id is not null and cp.user_id = cc.user_id)
    )
  where o2.counterparty_id is null
  order by o2.id, (cp.customer_id = cc.id) desc, cp.created_at desc
) resolved
where o.id = resolved.order_id;
