-- SHO-229 files-T14: purpose catalog|document, dual object-key CHECK, nullable uploader.
ALTER TABLE "files" DROP CONSTRAINT "files_object_key_catalog_prefix_check";--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_purpose_check";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "uploaded_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_object_key_purpose_prefix_check" CHECK (("files"."purpose" = 'catalog' AND "files"."object_key" = "files"."company_id"::text || '/catalog/' || "files"."id"::text) OR ("files"."purpose" = 'document' AND "files"."object_key" = "files"."company_id"::text || '/documents/' || "files"."id"::text));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose_check" CHECK ("files"."purpose" IN ('catalog', 'document'));