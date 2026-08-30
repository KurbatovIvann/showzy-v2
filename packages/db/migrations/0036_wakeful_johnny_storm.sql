ALTER TABLE "document_share_tokens" ADD COLUMN "signed_download_url" text;--> statement-breakpoint
ALTER TABLE "document_share_tokens" ADD COLUMN "signed_download_expires_at" timestamp with time zone;