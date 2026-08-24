CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_media_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "product_media_product_file_uq" UNIQUE("company_id","product_id","file_id"),
	CONSTRAINT "product_media_position_check" CHECK ("product_media"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_products_company_fk" FOREIGN KEY ("company_id","product_id") REFERENCES "public"."products"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_files_company_fk" FOREIGN KEY ("company_id","file_id") REFERENCES "public"."files"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_media_company_idx" ON "product_media" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "product_media_product_idx" ON "product_media" USING btree ("company_id","product_id","position");--> statement-breakpoint
CREATE INDEX "product_media_file_idx" ON "product_media" USING btree ("company_id","file_id");--> statement-breakpoint
CREATE INDEX "products_company_status_idx" ON "products" USING btree ("company_id","status");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_status_check" CHECK ("product_variants"."status" IN ('active', 'archived'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_status_check" CHECK ("products"."status" IN ('active', 'archived'));