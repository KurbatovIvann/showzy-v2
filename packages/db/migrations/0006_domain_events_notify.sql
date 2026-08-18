-- Outbox LISTEN/NOTIFY wakeup (fnd-T27). Drizzle cannot express triggers:
-- docs/specs/db.md §7 (approved raw-SQL exceptions), ADR-0012. Payload is
-- the event name so logs can show what woke the worker; the worker still
-- claims via SKIP LOCKED and polls as fallback for retries and lost listens.
CREATE FUNCTION notify_domain_events() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('domain_events', NEW.name);
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER domain_events_notify
AFTER INSERT ON domain_events
FOR EACH ROW EXECUTE FUNCTION notify_domain_events();
