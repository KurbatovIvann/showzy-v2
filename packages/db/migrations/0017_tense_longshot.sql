CREATE TABLE "order_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_cards_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "order_cards_order_id_uq" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "order_cards" ADD CONSTRAINT "order_cards_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_cards" ADD CONSTRAINT "order_cards_orders_company_fk" FOREIGN KEY ("company_id","order_id") REFERENCES "public"."orders"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_cards_company_updated_at_idx" ON "order_cards" USING btree ("company_id","updated_at" DESC NULLS LAST);