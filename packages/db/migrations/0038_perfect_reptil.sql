ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_currency_check" CHECK ("product_variants"."currency" IS NULL OR "product_variants"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_currency_check" CHECK ("products"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_slug_check" CHECK ("companies"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length("companies"."slug") BETWEEN 3 AND 48);--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_prefix_check" CHECK ("companies"."prefix" ~ '^[A-Z0-9]+$');--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_sort_order_check" CHECK ("customer_groups"."sort_order" >= 0);--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_currency_check" CHECK ("document_items"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_currency_check" CHECK ("documents"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "company_customer_invites" ADD CONSTRAINT "company_customer_invites_uses_within_max_check" CHECK ("company_customer_invites"."max_uses" IS NULL OR "company_customer_invites"."uses_count" <= "company_customer_invites"."max_uses");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_currency_check" CHECK ("order_items"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_requires_confirmed_at_check" CHECK ("orders"."status" <> 'confirmed' OR "orders"."confirmed_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_new_forbids_confirmed_at_check" CHECK ("orders"."status" <> 'new' OR "orders"."confirmed_at" IS NULL);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_check" CHECK ("orders"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_currency_check" CHECK ("personal_prices"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_currency_check" CHECK ("price_list_entries"."currency" ~ '^[A-Z]{3}$');