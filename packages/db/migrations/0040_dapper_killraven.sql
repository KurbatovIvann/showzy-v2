ALTER TABLE "orders" ADD COLUMN "customer_name_snapshot" text DEFAULT 'unlinked' NOT NULL;--> statement-breakpoint
-- One-time backfill of orders.customer_name_snapshot from live CRM
-- (SHO-351). Unlinked headers (customer_id IS NULL) keep sentinel
-- `unlinked`. Runtime orders handlers must not JOIN company_customers
-- (ADR-0015). This UPDATE is the approved exception because Drizzle
-- cannot express a data backfill (db.md §7).
UPDATE "orders" AS o
SET "customer_name_snapshot" = c."name"
FROM "company_customers" AS c
WHERE o."customer_id" IS NOT NULL
  AND o."company_id" = c."company_id"
  AND o."customer_id" = c."id"
  AND char_length(c."name") > 0;--> statement-breakpoint
CREATE INDEX "order_items_company_order_id_idx" ON "order_items" USING btree ("company_id","order_id");--> statement-breakpoint
CREATE INDEX "orders_company_status_created_at_id_idx" ON "orders" USING btree ("company_id","status","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "orders_company_customer_id_created_at_id_idx" ON "orders" USING btree ("company_id","customer_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_name_snapshot_check" CHECK (char_length("orders"."customer_name_snapshot") > 0);
