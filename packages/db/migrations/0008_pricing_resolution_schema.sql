CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"base_price_minor" bigint,
	"currency" char(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_base_price_minor_check" CHECK ("product_variants"."base_price_minor" IS NULL OR "product_variants"."base_price_minor" >= 0),
	CONSTRAINT "product_variants_price_currency_check" CHECK (("product_variants"."base_price_minor" IS NULL) = ("product_variants"."currency" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"base_price_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'UAH' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_base_price_minor_check" CHECK ("products"."base_price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "company_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"group_id" uuid,
	"price_list_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"price_list_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"price_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'UAH' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_prices_price_minor_check" CHECK ("personal_prices"."price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_list_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"price_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'UAH' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_entries_price_minor_check" CHECK ("price_list_entries"."price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_group_id_customer_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."customer_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_customer_id_company_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."company_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_prices" ADD CONSTRAINT "personal_prices_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_entries" ADD CONSTRAINT "price_list_entries_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_variants_company_idx" ON "product_variants" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_company_idx" ON "products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_customers_company_idx" ON "company_customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_customers_group_idx" ON "company_customers" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "company_customers_price_list_idx" ON "company_customers" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "customer_groups_company_idx" ON "customer_groups" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "customer_groups_price_list_idx" ON "customer_groups" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "personal_prices_company_idx" ON "personal_prices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "personal_prices_product_idx" ON "personal_prices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "personal_prices_variant_idx" ON "personal_prices" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_prices_customer_product_uq" ON "personal_prices" USING btree ("customer_id","product_id") WHERE "personal_prices"."variant_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "personal_prices_customer_variant_uq" ON "personal_prices" USING btree ("customer_id","product_id","variant_id") WHERE "personal_prices"."variant_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "price_list_entries_company_idx" ON "price_list_entries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "price_list_entries_product_idx" ON "price_list_entries" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "price_list_entries_variant_idx" ON "price_list_entries" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_entries_list_product_uq" ON "price_list_entries" USING btree ("price_list_id","product_id") WHERE "price_list_entries"."variant_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_entries_list_variant_uq" ON "price_list_entries" USING btree ("price_list_id","product_id","variant_id") WHERE "price_list_entries"."variant_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "price_lists_company_idx" ON "price_lists" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_lists_company_default_uq" ON "price_lists" USING btree ("company_id") WHERE "price_lists"."is_default" = true;