CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"checksum_sha256" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "files_company_object_key_uq" UNIQUE("company_id","object_key"),
	CONSTRAINT "files_purpose_check" CHECK ("files"."purpose" IN ('catalog')),
	CONSTRAINT "files_status_check" CHECK ("files"."status" IN ('pending', 'ready')),
	CONSTRAINT "files_byte_size_check" CHECK ("files"."byte_size" >= 0),
	CONSTRAINT "files_checksum_sha256_check" CHECK ("files"."checksum_sha256" IS NULL OR "files"."checksum_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_company_idx" ON "files" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "files_company_status_idx" ON "files" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "files_uploaded_by_user_idx" ON "files" USING btree ("uploaded_by_user_id");