-- SHO-232 document_generation_jobs. One job per document (idempotent
-- retry target). Composite FK to documents is CASCADE so company wipe
-- and document delete remove the job; composite FK to files is RESTRICT
-- (T14 did not add SET NULL on file delete). Module tables attach the
-- shared updated_at primitive (db.md §5) here because Drizzle cannot
-- express triggers (db.md §7).
CREATE TABLE "document_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_generation_jobs_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "document_generation_jobs_document_id_uq" UNIQUE("document_id"),
	CONSTRAINT "document_generation_jobs_status_check" CHECK ("document_generation_jobs"."status" IN ('pending', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "document_generation_jobs" ADD CONSTRAINT "document_generation_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_generation_jobs" ADD CONSTRAINT "document_generation_jobs_documents_company_fk" FOREIGN KEY ("company_id","document_id") REFERENCES "public"."documents"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_generation_jobs" ADD CONSTRAINT "document_generation_jobs_files_company_fk" FOREIGN KEY ("company_id","file_id") REFERENCES "public"."files"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_generation_jobs_file_idx" ON "document_generation_jobs" USING btree ("file_id");
--> statement-breakpoint
CREATE TRIGGER document_generation_jobs_set_updated_at
BEFORE UPDATE ON document_generation_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
