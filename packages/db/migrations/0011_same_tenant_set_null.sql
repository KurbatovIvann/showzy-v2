-- Composite tenant FKs that include NOT NULL company_id cannot use
-- unrestricted ON DELETE SET NULL: Postgres would also null company_id.
-- Drizzle cannot emit PostgreSQL 15's column-scoped SET NULL (ADR-0025,
-- db.md §7). This migration is that approved exception.
ALTER TABLE "customer_groups" DROP CONSTRAINT "customer_groups_price_lists_company_fk";
--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_price_lists_company_fk" FOREIGN KEY ("company_id","price_list_id") REFERENCES "public"."price_lists"("company_id","id") ON DELETE SET NULL ("price_list_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_customers" DROP CONSTRAINT "company_customers_customer_groups_company_fk";
--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_customer_groups_company_fk" FOREIGN KEY ("company_id","group_id") REFERENCES "public"."customer_groups"("company_id","id") ON DELETE SET NULL ("group_id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "company_customers" DROP CONSTRAINT "company_customers_price_lists_company_fk";
--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_price_lists_company_fk" FOREIGN KEY ("company_id","price_list_id") REFERENCES "public"."price_lists"("company_id","id") ON DELETE SET NULL ("price_list_id") ON UPDATE no action;
