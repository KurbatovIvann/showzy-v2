DROP INDEX "product_media_company_idx";--> statement-breakpoint
DROP INDEX "product_variants_company_idx";--> statement-breakpoint
DROP INDEX "products_company_idx";--> statement-breakpoint
DROP INDEX "company_customers_company_idx";--> statement-breakpoint
DROP INDEX "company_customers_group_idx";--> statement-breakpoint
DROP INDEX "counterparties_company_idx";--> statement-breakpoint
DROP INDEX "customer_groups_company_idx";--> statement-breakpoint
DROP INDEX "document_items_company_idx";--> statement-breakpoint
DROP INDEX "files_company_idx";--> statement-breakpoint
DROP INDEX "company_customer_invites_company_idx";--> statement-breakpoint
DROP INDEX "order_items_company_idx";--> statement-breakpoint
DROP INDEX "personal_prices_company_idx";--> statement-breakpoint
DROP INDEX "price_list_entries_company_idx";--> statement-breakpoint
DROP INDEX "price_lists_company_idx";--> statement-breakpoint
DROP INDEX "documents_company_created_at_idx";--> statement-breakpoint
DROP INDEX "orders_company_created_at_idx";--> statement-breakpoint
CREATE INDEX "products_company_created_at_id_idx" ON "products" USING btree ("company_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "company_customers_company_updated_at_id_idx" ON "company_customers" USING btree ("company_id","updated_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "counterparties_company_updated_at_id_idx" ON "counterparties" USING btree ("company_id","updated_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "company_customer_invites_company_updated_at_id_idx" ON "company_customer_invites" USING btree ("company_id","updated_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "company_customer_invites_company_group_idx" ON "company_customer_invites" USING btree ("company_id","group_id") WHERE "company_customer_invites"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "company_customer_invites_company_price_list_idx" ON "company_customer_invites" USING btree ("company_id","price_list_id") WHERE "company_customer_invites"."price_list_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "documents_company_created_at_idx" ON "documents" USING btree ("company_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "orders_company_created_at_idx" ON "orders" USING btree ("company_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);