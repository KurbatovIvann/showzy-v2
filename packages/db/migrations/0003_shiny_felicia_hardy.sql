CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb DEFAULT '{"granted":[],"denied":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_members_role_check" CHECK ("company_members"."role" IN ('owner', 'admin', 'manager', 'employee'))
);
--> statement-breakpoint
CREATE TABLE "role_permission_defaults" (
	"role" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permission_defaults_pk" PRIMARY KEY("role","permission")
);
--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_slug_uq" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_prefix_uq" ON "companies" USING btree ("prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "company_members_company_user_uq" ON "company_members" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "company_members_user_company_idx" ON "company_members" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE INDEX "company_members_company_role_idx" ON "company_members" USING btree ("company_id","role");