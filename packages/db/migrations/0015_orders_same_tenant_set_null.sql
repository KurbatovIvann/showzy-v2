-- Composite tenant FKs that include NOT NULL company_id cannot use
-- unrestricted ON DELETE SET NULL: Postgres would also null company_id.
-- Drizzle cannot emit PostgreSQL 15's column-scoped SET NULL (ADR-0025,
-- db.md §7). This migration is that approved exception.
ALTER TABLE "orders" DROP CONSTRAINT "orders_company_customers_company_fk";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_customers_company_fk" FOREIGN KEY ("company_id","customer_id") REFERENCES "public"."company_customers"("company_id","id") ON DELETE SET NULL ("customer_id") ON UPDATE no action;
