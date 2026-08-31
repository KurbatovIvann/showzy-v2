-- Foundation raw-SQL primitives (fnd-T4). Raw SQL is approved here because
-- Drizzle cannot express trigger functions, roles, grants, or default
-- privileges: docs/specs/db.md §5 (triggers policy), §6 (roles and safety),
-- §7 (approved raw-SQL exceptions). The outbox claim/notify primitives
-- (SKIP LOCKED, LISTEN/NOTIFY, advisory locks — ADR-0012) arrive with the
-- event-delivery tasks, not here.

-- Shared updated_at touch trigger (db.md §5). The only trigger with a home in
-- the database; module migrations attach it per table:
--   CREATE TRIGGER <table>_set_updated_at BEFORE UPDATE ON <table>
--   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Roles (db.md §6), created as NOLOGIN privilege containers. Environments
-- attach LOGIN users/credentials outside the repo (test harness does this
-- for CI) — a migration must never carry a password. The test harness
-- CREATE ROLE … LOGIN PASSWORD uses a per-run randomUUID(); that is not
-- the Testcontainers/compose superuser password and is not stored in the
-- repo. Roles are
-- cluster-level, so creation is guarded for template-database copies and
-- reruns against the same cluster.
DO $$
BEGIN
  -- Runtime role: DML only; audit_log append-only; no TRUNCATE, no DDL.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'showzy_app') THEN
    CREATE ROLE showzy_app NOLOGIN;
  END IF;
  -- Migration role: DDL, used only by the CI/deploy migration step.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'showzy_migrate') THEN
    CREATE ROLE showzy_migrate NOLOGIN;
  END IF;
  -- Maintenance role: scheduled archival/retention jobs only (audit expiry).
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'showzy_maintenance') THEN
    CREATE ROLE showzy_maintenance NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO showzy_app, showzy_maintenance;
--> statement-breakpoint
GRANT USAGE, CREATE ON SCHEMA public TO showzy_migrate;
--> statement-breakpoint

-- Runtime DML on everything that exists now…
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO showzy_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO showzy_app;
--> statement-breakpoint

-- …and on every table future migrations create. Bound to the role running
-- migrations (the harness admin in CI, showzy_migrate in real environments),
-- which is the creator of all subsequent tables in that environment.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO showzy_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO showzy_app;
--> statement-breakpoint

-- audit_log is append-only for the runtime role (db.md §4/§6): INSERT and
-- SELECT stay, mutation goes. TRUNCATE was never granted.
REVOKE UPDATE, DELETE ON audit_log FROM showzy_app;
--> statement-breakpoint

-- Maintenance role: narrowly the audit-expiry job for now (core.md §8
-- retention). Additional grants only via the owning spec.
GRANT SELECT, DELETE ON audit_log TO showzy_maintenance;
