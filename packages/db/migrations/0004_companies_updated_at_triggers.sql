-- Module tables attach the shared updated_at primitive from
-- docs/specs/db.md §5. Drizzle cannot express triggers; this custom
-- migration is the explicitly approved raw-SQL exception from db.md §7.
CREATE TRIGGER companies_set_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER company_members_set_updated_at
BEFORE UPDATE ON company_members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();