-- Module tables attach the shared updated_at primitive from
-- docs/specs/db.md §5. Drizzle cannot express triggers; this custom
-- migration is the explicitly approved raw-SQL exception from db.md §7.
-- order_items is an immutable snapshot table and must not attach the trigger.
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
