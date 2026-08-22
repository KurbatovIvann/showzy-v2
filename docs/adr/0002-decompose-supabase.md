# ADR-0002: Decompose Supabase into self-hosted components

- **Status**: Accepted
- **Date**: 2026-08-16
- **Amended by**: ADR-0027

## Context

v1 is built on Supabase (Postgres, Auth, Storage, Realtime, RLS, typegen).
This couples the product to one vendor's subscription and its architectural
model (clients querying the DB directly), which produced ~240 RLS policies
and ~79 RPC functions — the hardest part of v1 to maintain.

## Decision

Replace Supabase with independent components: self-hosted PostgreSQL 17 +
Drizzle, better-auth, object storage over the S3 API (Garage locally →
Cloudflare R2 in prod; ADR-0027), Socket.IO + Redis for realtime, and
application-level permissions.

## Alternatives considered

- **Keep Supabase** — rejected: vendor lock-in, and the direct-DB-access model
  conflicts with the "one data path through the action registry" principle.
- **Another BaaS (Firebase, Appwrite)** — rejected for the same structural
  reasons plus weaker Postgres control.

## Consequences

- No vendor lock-in; every component is a container we control.
- We own auth, storage signing, and realtime infrastructure (more setup in
  phase 0, offset by deleting the entire RLS/RPC layer).
