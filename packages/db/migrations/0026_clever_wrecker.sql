-- SHO-202 invite tokens. Composite tenant FKs that include NOT NULL
-- company_id cannot use unrestricted ON DELETE SET NULL: Postgres would
-- also null company_id. Drizzle cannot emit PostgreSQL 15's column-scoped
-- SET NULL (ADR-0025, db.md §7). The group_id / price_list_id clauses
-- below are that approved exception.
--
-- Module tables attach the shared updated_at primitive (db.md §5) here
-- because Drizzle cannot express triggers (db.md §7). Redemptions have
-- no updated_at.
CREATE TABLE "company_customer_invite_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"company_customer_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "company_customer_invite_redemptions_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "company_customer_invite_redemptions_invite_user_uq" UNIQUE("invite_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "company_customer_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invited_by" text NOT NULL,
	"token_hash" text NOT NULL,
	"is_reusable" boolean NOT NULL,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"group_id" uuid,
	"price_list_id" uuid,
	"name" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_customer_invites_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "company_customer_invites_token_hash_uq" UNIQUE("token_hash"),
	CONSTRAINT "company_customer_invites_status_check" CHECK ("company_customer_invites"."status" IN ('pending', 'revoked')),
	CONSTRAINT "company_customer_invites_uses_count_check" CHECK ("company_customer_invites"."uses_count" >= 0),
	CONSTRAINT "company_customer_invites_max_uses_check" CHECK ("company_customer_invites"."max_uses" IS NULL OR "company_customer_invites"."max_uses" >= 1),
	CONSTRAINT "company_customer_invites_personal_check" CHECK ("company_customer_invites"."is_reusable" = true OR ("company_customer_invites"."max_uses" IS NOT NULL AND "company_customer_invites"."max_uses" = 1))
);
--> statement-breakpoint
ALTER TABLE "company_customer_invite_redemptions" ADD CONSTRAINT "company_customer_invite_redemptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customer_invite_redemptions" ADD CONSTRAINT "company_customer_invite_redemptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customer_invite_redemptions" ADD CONSTRAINT "company_customer_invite_redemptions_invites_company_fk" FOREIGN KEY ("company_id","invite_id") REFERENCES "public"."company_customer_invites"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customer_invite_redemptions" ADD CONSTRAINT "company_customer_invite_redemptions_customers_company_fk" FOREIGN KEY ("company_id","company_customer_id") REFERENCES "public"."company_customers"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customer_invites" ADD CONSTRAINT "company_customer_invites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customer_invites" ADD CONSTRAINT "company_customer_invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customer_invites" ADD CONSTRAINT "company_customer_invites_customer_groups_company_fk" FOREIGN KEY ("company_id","group_id") REFERENCES "public"."customer_groups"("company_id","id") ON DELETE SET NULL ("group_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_customer_invites" ADD CONSTRAINT "company_customer_invites_price_lists_company_fk" FOREIGN KEY ("company_id","price_list_id") REFERENCES "public"."price_lists"("company_id","id") ON DELETE SET NULL ("price_list_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_customer_invite_redemptions_company_customer_idx" ON "company_customer_invite_redemptions" USING btree ("company_id","company_customer_id");--> statement-breakpoint
CREATE INDEX "company_customer_invites_company_idx" ON "company_customer_invites" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_customer_invites_company_status_idx" ON "company_customer_invites" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "company_customer_invites_pending_expires_at_idx" ON "company_customer_invites" USING btree ("expires_at") WHERE "company_customer_invites"."status" = 'pending';--> statement-breakpoint
CREATE TRIGGER company_customer_invites_set_updated_at
BEFORE UPDATE ON company_customer_invites
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
