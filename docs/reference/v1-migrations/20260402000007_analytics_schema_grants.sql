-- ============================================================================
-- Migration: analytics_schema_grants
-- Description: Grants service_role USAGE on the analytics schema and full
--              table privileges so the NestJS API can insert into
--              analytics.events (and read/write summary tables) directly.
-- Dependencies: 20260402000001_analytics_schema
--
-- Background: service_role has bypassrls but still needs standard Postgres
--             USAGE + table-level grants for non-public schemas.
-- ============================================================================

-- Allow service_role to reference objects in the analytics schema
grant usage on schema analytics to service_role;

-- Grant full privileges on all existing tables (events, summary tables)
grant all on all tables in schema analytics to service_role;

-- Grant usage on sequences (identity columns, partitioned tables)
grant all on all sequences in schema analytics to service_role;

-- Ensure future tables created in the analytics schema inherit these grants
alter default privileges in schema analytics
  grant all on tables to service_role;

alter default privileges in schema analytics
  grant all on sequences to service_role;
