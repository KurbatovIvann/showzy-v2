# Spec: companies foundation schema slice

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> This is a deliberately minimal phase-0 prerequisite, not the full companies
> module spec. It may create only tenant/RBAC identity required by core tests.

## 1. Purpose and boundary

This slice gives core a real tenant root and membership/permission model.
`companies` owns all three tables in `packages/db/src/schema/companies.ts`;
they never move into `foundation.ts`. Onboarding, profile, legal requisites,
team-management actions, and UI remain in the later full companies spec.

## 2. Tables

`companies`: `id uuid` PK, `name text`, unique `slug text`, unique
`prefix text`, `created_at`, `updated_at`. The foundation slice adds no
profile/search/geo/counter/embedding columns.

`company_members`: `id uuid` PK, `company_id uuid` FK to companies
(`ON DELETE CASCADE`), `user_id` using the generated better-auth user ID type
(`ON DELETE RESTRICT`), `role text CHECK
(owner|admin|manager|employee)`, `permissions jsonb` with canonical
`{ granted: string[], denied: string[] }`, timestamps, unique
`(company_id, user_id)`. Indexes `(user_id, company_id)` and
`(company_id, role)`.

`role_permission_defaults`: global seed table, `role text`, `permission text`,
PK `(role, permission)`. Owner has all known permissions implicitly; explicit
deny wins, then explicit grant, then role default. Unknown permission keys
fail the action contract/catalog check.

The invariant “a company has at least one owner” is enforced by later
companies actions/transactions, not a hidden DB trigger. Test factories may
insert fixtures directly only under the test harness.

## 3. v1 migration slice

- `companies`: TRANSFORM from
  `20260301000003_companies.sql`; carry only id/name/slug/prefix/timestamps in
  phase 0. Profile/legal/FTS fields wait for the full spec; embeddings and
  denormalized social counters drop.
- `company_members`, `role_permission_defaults`: TRANSFORM from
  `20260301000005_company_members.sql`; Supabase `users.id` FKs are remapped
  to better-auth IDs. SQL permission helpers/RLS policies drop in favor of
  core factories and action checks.
- Business-category REVIEW rows in the global matrix are outside this slice
  and do not authorize importing those tables.

## 4. Acceptance criteria

- [ ] Staff context derives company only from a membership matching
      authenticated user + selected company; missing/foreign membership is
      denied.
- [ ] Owner/default/granted/denied precedence matches the rule above.
- [ ] Cross-company role/override rows cannot influence another company.
- [ ] Runtime role can read membership for authorization but no client route
      or client bundle can reach these tables.
- [ ] Schema/migration tests use the generated better-auth ID type without
      casts and reconcile v1 member user IDs through the auth mapping.
- [ ] Full companies spec can add profile/legal fields without moving or
      renaming the foundation tables.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial foundation slice | Unblock staff principal integration without giving core domain ownership | GPT-5.6 Sol |
