-- SHO-223 company_legal_info. 1:1 seller legal face; no backfill — a
-- company without a row is "legal not yet filled". Module tables attach
-- the shared updated_at primitive (db.md §5) here because Drizzle cannot
-- express triggers (db.md §7).
CREATE TABLE "company_legal_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"company_type" text DEFAULT 'fop' NOT NULL,
	"legal_name" text,
	"edrpou" text,
	"legal_address" text,
	"iban" text,
	"bank_name" text,
	"bank_mfo" text,
	"bank_edrpou" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_legal_info_company_id_uq" UNIQUE("company_id"),
	CONSTRAINT "company_legal_info_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "company_legal_info_company_type_check" CHECK ("company_legal_info"."company_type" IN ('fop', 'tov'))
);
--> statement-breakpoint
ALTER TABLE "company_legal_info" ADD CONSTRAINT "company_legal_info_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER company_legal_info_set_updated_at
BEFORE UPDATE ON company_legal_info
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
