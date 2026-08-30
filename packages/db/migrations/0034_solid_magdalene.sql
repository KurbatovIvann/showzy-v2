-- SHO-254 signing_requests + signing_signatures. Composite FKs to
-- documents and files are RESTRICT so a signed payload cannot vanish
-- under a request. UNIQUE (company_id, id) is ADR-0025. One live pending
-- request per document (partial unique). signer_role CHECK supplier only.
-- Module tables attach the shared updated_at primitive (db.md §5) because
-- Drizzle cannot express triggers (db.md §7) — see the trigger at the end.
CREATE TABLE "signing_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"payload_file_id" uuid NOT NULL,
	"payload_sha256" text NOT NULL,
	"payload_digest_algorithm" text DEFAULT 'sha256' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signing_requests_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "signing_requests_status_check" CHECK ("signing_requests"."status" IN ('pending', 'completed')),
	CONSTRAINT "signing_requests_payload_sha256_check" CHECK ("signing_requests"."payload_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "signing_requests_payload_digest_algorithm_check" CHECK ("signing_requests"."payload_digest_algorithm" IN ('sha256'))
);
--> statement-breakpoint
CREATE TABLE "signing_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_role" text NOT NULL,
	"file_id" uuid NOT NULL,
	"signer_cn" text NOT NULL,
	"signer_org" text NOT NULL,
	"signer_tax_id" text NOT NULL,
	"signature_alg" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signing_signatures_company_id_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "signing_signatures_document_id_signer_role_uq" UNIQUE("document_id","signer_role"),
	CONSTRAINT "signing_signatures_signer_role_check" CHECK ("signing_signatures"."signer_role" IN ('supplier'))
);
--> statement-breakpoint
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_documents_company_fk" FOREIGN KEY ("company_id","document_id") REFERENCES "public"."documents"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_payload_files_company_fk" FOREIGN KEY ("company_id","payload_file_id") REFERENCES "public"."files"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_signatures" ADD CONSTRAINT "signing_signatures_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_signatures" ADD CONSTRAINT "signing_signatures_documents_company_fk" FOREIGN KEY ("company_id","document_id") REFERENCES "public"."documents"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_signatures" ADD CONSTRAINT "signing_signatures_files_company_fk" FOREIGN KEY ("company_id","file_id") REFERENCES "public"."files"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signing_requests_document_id_pending_uq" ON "signing_requests" USING btree ("document_id") WHERE "signing_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "signing_requests_company_document_idx" ON "signing_requests" USING btree ("company_id","document_id");--> statement-breakpoint
CREATE INDEX "signing_requests_payload_file_idx" ON "signing_requests" USING btree ("payload_file_id");--> statement-breakpoint
CREATE INDEX "signing_signatures_company_document_idx" ON "signing_signatures" USING btree ("company_id","document_id");--> statement-breakpoint
CREATE INDEX "signing_signatures_file_idx" ON "signing_signatures" USING btree ("file_id");
--> statement-breakpoint
-- Module tables attach the shared updated_at primitive (db.md §5) here
-- because Drizzle cannot express triggers (db.md §7). signing_signatures
-- has no updated_at (immutable cert snapshot).
CREATE TRIGGER signing_requests_set_updated_at
BEFORE UPDATE ON signing_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();