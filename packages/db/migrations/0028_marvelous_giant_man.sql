-- SHO-228 documents schema slice. No default_document_templates, no year
-- on the counter. Module tables attach the shared updated_at primitive
-- (db.md §5) here because Drizzle cannot express triggers (db.md §7).
-- document_items is an immutable snapshot table and must not attach the
-- trigger; counters and share tokens have no updated_at.
CREATE TABLE "document_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_items_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "document_items_quantity_milli_check" CHECK ("document_items"."quantity_milli" > 0),
	CONSTRAINT "document_items_unit_price_minor_check" CHECK ("document_items"."unit_price_minor" >= 0),
	CONSTRAINT "document_items_discount_kind_check" CHECK ("document_items"."discount_kind" IN ('none')),
	CONSTRAINT "document_items_discount_amount_minor_check" CHECK ("document_items"."discount_amount_minor" >= 0),
	CONSTRAINT "document_items_tax_treatment_check" CHECK ("document_items"."tax_treatment" IN ('exempt', 'inclusive', 'exclusive')),
	CONSTRAINT "document_items_tax_rate_bp_check" CHECK ("document_items"."tax_rate_bp" >= 0),
	CONSTRAINT "document_items_tax_amount_minor_check" CHECK ("document_items"."tax_amount_minor" >= 0),
	CONSTRAINT "document_items_net_amount_minor_check" CHECK ("document_items"."net_amount_minor" >= 0),
	CONSTRAINT "document_items_gross_amount_minor_check" CHECK ("document_items"."gross_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "document_number_counters" (
	"company_id" uuid NOT NULL,
	"type" text NOT NULL,
	"last_number" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "document_number_counters_pk" PRIMARY KEY("company_id","type"),
	CONSTRAINT "document_number_counters_type_check" CHECK ("document_number_counters"."type" IN ('payment_invoice', 'delivery_note')),
	CONSTRAINT "document_number_counters_last_number_check" CHECK ("document_number_counters"."last_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "document_share_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"pdf_download_url" text,
	"pdf_download_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_share_tokens_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "document_share_tokens_token_hash_uq" UNIQUE("token_hash"),
	CONSTRAINT "document_share_tokens_token_hash_check" CHECK ("document_share_tokens"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"counterparty_id" uuid,
	"type" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"document_number" text NOT NULL,
	"issued_on" date NOT NULL,
	"supplier_details" jsonb NOT NULL,
	"buyer_details" jsonb NOT NULL,
	"total_net_minor" bigint NOT NULL,
	"total_tax_minor" bigint NOT NULL,
	"total_gross_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'UAH' NOT NULL,
	"template_source" text DEFAULT 'system' NOT NULL,
	"template_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "documents_company_type_document_number_uq" UNIQUE("company_id","type","document_number"),
	CONSTRAINT "documents_type_check" CHECK ("documents"."type" IN ('payment_invoice', 'delivery_note')),
	CONSTRAINT "documents_status_check" CHECK ("documents"."status" IN ('issued', 'cancelled')),
	CONSTRAINT "documents_total_net_minor_check" CHECK ("documents"."total_net_minor" >= 0),
	CONSTRAINT "documents_total_tax_minor_check" CHECK ("documents"."total_tax_minor" >= 0),
	CONSTRAINT "documents_total_gross_minor_check" CHECK ("documents"."total_gross_minor" >= 0),
	CONSTRAINT "documents_template_source_check" CHECK ("documents"."template_source" IN ('system'))
);
--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_documents_company_fk" FOREIGN KEY ("company_id","document_id") REFERENCES "public"."documents"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_products_company_fk" FOREIGN KEY ("company_id","product_id") REFERENCES "public"."products"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_product_variants_company_fk" FOREIGN KEY ("company_id","variant_id") REFERENCES "public"."product_variants"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_number_counters" ADD CONSTRAINT "document_number_counters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_share_tokens" ADD CONSTRAINT "document_share_tokens_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_share_tokens" ADD CONSTRAINT "document_share_tokens_documents_company_fk" FOREIGN KEY ("company_id","document_id") REFERENCES "public"."documents"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_orders_company_fk" FOREIGN KEY ("company_id","order_id") REFERENCES "public"."orders"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_counterparties_company_fk" FOREIGN KEY ("company_id","counterparty_id") REFERENCES "public"."counterparties"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_items_document_idx" ON "document_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_items_company_idx" ON "document_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "document_items_product_idx" ON "document_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "document_items_variant_idx" ON "document_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_share_tokens_document_id_active_uq" ON "document_share_tokens" USING btree ("document_id") WHERE "document_share_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "document_share_tokens_company_document_idx" ON "document_share_tokens" USING btree ("company_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_company_order_type_live_uq" ON "documents" USING btree ("company_id","order_id","type") WHERE "documents"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "documents_company_created_at_idx" ON "documents" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_company_status_idx" ON "documents" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "documents_company_type_idx" ON "documents" USING btree ("company_id","type");--> statement-breakpoint
CREATE INDEX "documents_order_idx" ON "documents" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "documents_counterparty_idx" ON "documents" USING btree ("counterparty_id");
--> statement-breakpoint
CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();