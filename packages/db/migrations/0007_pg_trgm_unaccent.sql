-- Search extensions (pg_trgm, unaccent). Drizzle cannot express CREATE
-- EXTENSION: docs/specs/db.md §3 (only sanctioned extensions) and §7
-- (approved raw-SQL exceptions). Compose init also creates them for a
-- fresh local volume; this migration is the source of truth for
-- Testcontainers and production so GIN/trigram indexes in `search` can
-- land without a pre-step. The migrate role must be allowed to CREATE
-- EXTENSION (superuser or equivalent in real environments).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
