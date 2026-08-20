ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "company_customers" DROP CONSTRAINT "company_customers_group_id_customer_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "company_customers" DROP CONSTRAINT "company_customers_price_list_id_price_lists_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_groups" DROP CONSTRAINT "customer_groups_price_list_id_price_lists_id_fk";
--> statement-breakpoint
ALTER TABLE "personal_prices" DROP CONSTRAINT "personal_prices_customer_id_company_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "personal_prices" DROP CONSTRAINT "personal_prices_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "personal_prices" DROP CONSTRAINT "personal_prices_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "price_list_entries" DROP CONSTRAINT "price_list_entries_price_list_id_price_lists_id_fk";
--> statement-breakpoint
ALTER TABLE "price_list_entries" DROP CONSTRAINT "price_list_entries_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "price_list_entries" DROP CONSTRAINT "price_list_entries_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_products_company_fk" FOREIGN KEY ("company_id","product_id") REFERENCES "public"."products"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_customer_groups_company_fk" FOREIGN KEY ("company_id","group_id") REFERENCES "public"."customer_groups"("company_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_price_lists_company_fk" FOREIGN KEY ("company_id","price_list_id") REFERENCES "public"."price_lists"("company_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_price_lists_company_fk" FOREIGN KEY ("company_id","price_list_id") REFERENCES "public"."price_lists"("company_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_company_customers_company_fk" FOREIGN KEY ("company_id","customer_id") REFERENCES "public"."company_customers"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_products_company_fk" FOREIGN KEY ("company_id","product_id") REFERENCES "public"."products"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_product_variants_company_fk" FOREIGN KEY ("company_id","variant_id") REFERENCES "public"."product_variants"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_price_lists_company_fk" FOREIGN KEY ("company_id","price_list_id") REFERENCES "public"."price_lists"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_products_company_fk" FOREIGN KEY ("company_id","product_id") REFERENCES "public"."products"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_product_variants_company_fk" FOREIGN KEY ("company_id","variant_id") REFERENCES "public"."product_variants"("company_id","id") ON DELETE cascade ON UPDATE no action;
