CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"title_snapshot" text NOT NULL,
	"quantity_milli" bigint NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"discount_kind" text DEFAULT 'none' NOT NULL,
	"discount_value" bigint DEFAULT 0 NOT NULL,
	"discount_amount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_treatment" text NOT NULL,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"net_amount_minor" bigint NOT NULL,
	"gross_amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'UAH' NOT NULL,
	"price_source" text,
	"personal_price_id" uuid,
	"price_list_id" uuid,
	"price_list_entry_id" uuid,
	"resolver_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "order_items_quantity_milli_check" CHECK ("order_items"."quantity_milli" > 0),
	CONSTRAINT "order_items_unit_price_minor_check" CHECK ("order_items"."unit_price_minor" >= 0),
	CONSTRAINT "order_items_discount_kind_check" CHECK ("order_items"."discount_kind" IN ('none')),
	CONSTRAINT "order_items_discount_amount_minor_check" CHECK ("order_items"."discount_amount_minor" >= 0),
	CONSTRAINT "order_items_tax_treatment_check" CHECK ("order_items"."tax_treatment" IN ('exempt', 'inclusive', 'exclusive')),
	CONSTRAINT "order_items_tax_rate_bp_check" CHECK ("order_items"."tax_rate_bp" >= 0),
	CONSTRAINT "order_items_tax_amount_minor_check" CHECK ("order_items"."tax_amount_minor" >= 0),
	CONSTRAINT "order_items_net_amount_minor_check" CHECK ("order_items"."net_amount_minor" >= 0),
	CONSTRAINT "order_items_gross_amount_minor_check" CHECK ("order_items"."gross_amount_minor" >= 0),
	CONSTRAINT "order_items_price_source_check" CHECK ("order_items"."price_source" IN ('personal', 'customer_price_list', 'group_price_list', 'default_price_list', 'base'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"comment" text,
	"total_net_minor" bigint NOT NULL,
	"total_tax_minor" bigint NOT NULL,
	"total_gross_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'UAH' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('new', 'confirmed', 'canceled')),
	CONSTRAINT "orders_total_net_minor_check" CHECK ("orders"."total_net_minor" >= 0),
	CONSTRAINT "orders_total_tax_minor_check" CHECK ("orders"."total_tax_minor" >= 0),
	CONSTRAINT "orders_total_gross_minor_check" CHECK ("orders"."total_gross_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orders_company_fk" FOREIGN KEY ("company_id","order_id") REFERENCES "public"."orders"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_products_company_fk" FOREIGN KEY ("company_id","product_id") REFERENCES "public"."products"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variants_company_fk" FOREIGN KEY ("company_id","variant_id") REFERENCES "public"."product_variants"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_customers_company_fk" FOREIGN KEY ("company_id","customer_id") REFERENCES "public"."company_customers"("company_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_company_idx" ON "order_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_company_created_at_idx" ON "orders" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_company_status_idx" ON "orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");