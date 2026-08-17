-- Approved raw SQL: local-dev bootstrap of the only two sanctioned Postgres
-- extensions (docs/specs/db.md §3, blueprint §3). Runs once on first
-- container boot against the dev database; migrations own all other DDL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
