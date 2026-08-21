-- Module tables attach the shared updated_at primitive from
-- docs/specs/db.md §5. Drizzle cannot express triggers; this custom
-- migration is the explicitly approved raw-SQL exception from db.md §7.
CREATE TRIGGER order_cards_set_updated_at
BEFORE UPDATE ON order_cards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
