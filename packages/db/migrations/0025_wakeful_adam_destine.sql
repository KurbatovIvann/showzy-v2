-- SHO-170 CRM widen. Drizzle emits `ADD COLUMN … NOT NULL` with no default,
-- which PostgreSQL rejects on a non-empty table (23502). Assignment-only
-- customer_groups / company_customers rows from the pricing slice are
-- backfilled before NOT NULL and the contact CHECK: groups get a
-- deterministic name/slug from id; customers get a placeholder name and a
-- distinct `legacy.{id}@invalid.local` email (satisfies CHECK; avoids
-- collapsing checkout-match lookups onto one email). Nullable adds +
-- per-row UPDATE + SET NOT NULL are the db.md §7 exception for widening
-- populated tables (0012 used a temporary DEFAULT for catalog `name`).
--
-- Counterparties composite FK uses PostgreSQL 15 `ON DELETE SET NULL
-- (customer_id)` so a customer delete cannot null NOT NULL company_id
-- (ADR-0025, db.md §7). Module tables attach the shared updated_at
-- primitive (db.md §5) here because Drizzle cannot express triggers.
--
-- User delete SET NULLs company_customers.user_id. When user_id is the
-- only contact, that SET NULL would fail company_customers_contact_check
-- and block account teardown. The BEFORE DELETE trigger on "user" stamps
-- the same placeholder email first (db.md §7); application UPDATEs that
-- clear every contact still fail the CHECK.
CREATE TABLE "counterparties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid,
	"name" text NOT NULL,
	"edrpou" text,
	"legal_address" text,
	"iban" text,
	"bank_name" text,
	"bank_mfo" text,
	"phone" text,
	"email" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counterparties_company_id_id_uq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "customer_legal_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text DEFAULT 'fop' NOT NULL,
	"legal_name" text,
	"edrpou" text,
	"legal_address" text,
	"iban" text,
	"bank_name" text,
	"bank_mfo" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_legal_profiles_user_id_uq" UNIQUE("user_id"),
	CONSTRAINT "customer_legal_profiles_entity_type_check" CHECK ("customer_legal_profiles"."entity_type" IN ('fop', 'tov'))
);
--> statement-breakpoint
ALTER TABLE "company_customers" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "company_customers" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "company_customers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "company_customers" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "company_customers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "company_customers" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "customer_groups"
SET
	"name" = 'Group ' || replace("id"::text, '-', ''),
	"slug" = 'group-' || replace("id"::text, '-', '')
WHERE "name" IS NULL;--> statement-breakpoint
UPDATE "company_customers"
SET
	"name" = 'Customer ' || replace("id"::text, '-', ''),
	"email" = 'legacy.' || "id"::text || '@invalid.local'
WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "company_customers" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_groups" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_groups" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_company_customers_company_fk" FOREIGN KEY ("company_id","customer_id") REFERENCES "public"."company_customers"("company_id","id") ON DELETE SET NULL ("customer_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_legal_profiles" ADD CONSTRAINT "customer_legal_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "counterparties_company_edrpou_uq" ON "counterparties" USING btree ("company_id","edrpou") WHERE "counterparties"."edrpou" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "counterparties_company_idx" ON "counterparties" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "counterparties_company_customer_idx" ON "counterparties" USING btree ("company_id","customer_id");--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_customers_company_user_uq" ON "company_customers" USING btree ("company_id","user_id") WHERE "company_customers"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "company_customers_company_status_idx" ON "company_customers" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "company_customers_company_group_idx" ON "company_customers" USING btree ("company_id","group_id") WHERE "company_customers"."group_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "company_customers_company_phone_unlinked_idx" ON "company_customers" USING btree ("company_id","phone") WHERE "company_customers"."user_id" IS NULL;--> statement-breakpoint
CREATE INDEX "company_customers_company_email_unlinked_idx" ON "company_customers" USING btree ("company_id","email") WHERE "company_customers"."user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_company_slug_uq" UNIQUE("company_id","slug");--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_status_check" CHECK ("company_customers"."status" IN ('active', 'archived'));--> statement-breakpoint
ALTER TABLE "company_customers" ADD CONSTRAINT "company_customers_contact_check" CHECK ("company_customers"."phone" IS NOT NULL OR "company_customers"."email" IS NOT NULL OR "company_customers"."user_id" IS NOT NULL);--> statement-breakpoint
CREATE FUNCTION company_customers_preserve_contact_on_user_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE company_customers
  SET email = 'legacy.' || id::text || '@invalid.local'
  WHERE user_id = OLD.id
    AND phone IS NULL
    AND email IS NULL;
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER company_customers_preserve_contact_on_user_delete
BEFORE DELETE ON "user"
FOR EACH ROW EXECUTE FUNCTION company_customers_preserve_contact_on_user_delete();--> statement-breakpoint
GRANT EXECUTE ON FUNCTION company_customers_preserve_contact_on_user_delete() TO showzy_app;--> statement-breakpoint
CREATE TRIGGER counterparties_set_updated_at
BEFORE UPDATE ON counterparties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER customer_legal_profiles_set_updated_at
BEFORE UPDATE ON customer_legal_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
