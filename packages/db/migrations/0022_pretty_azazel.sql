ALTER TABLE "files" ADD COLUMN "staging_purged_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "files_status_created_at_id_idx" ON "files" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "files_ready_leftover_sweep_idx" ON "files" USING btree ("updated_at","id") WHERE "files"."status" = 'ready' AND "files"."staging_purged_at" IS NULL;