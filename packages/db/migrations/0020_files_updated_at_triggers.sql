-- Module tables attach the shared updated_at primitive from
-- docs/specs/db.md §5. Drizzle cannot express triggers; this custom
-- migration is the explicitly approved raw-SQL exception from db.md §7.
CREATE TRIGGER files_set_updated_at
BEFORE UPDATE ON files
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
