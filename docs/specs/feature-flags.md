# Spec: feature-flags foundation

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Phase-0 skeleton only; billing/subscriptions remain post-MVP.

## 1. Purpose and tables

`feature-flags` owns capability gating, not billing. `feature_flags` is a
global seeded definition table (`key`, description, default, exposure);
`company_feature_overrides` owns `company_id`, flag key, enabled, reason,
actor, timestamps, unique `(company_id, key)`.

Unknown flags fail closed. Definitions are code-reviewed seed data; ordinary
runtime code cannot create a new definition dynamically.

## 2. Actions

- Principal-compatible transport-internal/AI-internal reads
  (`featureFlags.getForStaff`, `getForCustomer`, `getForPublic`,
  `getForSystem`) are `risk: read`, unaudited/non-idempotent, timeout 1s,
  emit none, and accept `{ keys: string[] }` → `{ key, enabled }[]`.
  Staff permission is `featureFlags:read`; other permissions are `[]`.
  Customer/public nested resolvers inherit and revalidate the caller's
  verified company scope; system scope is tenant (core.md §9).
- `featureFlags.setOverride` is staff-only, transport client/AI exposed,
  permission `featureFlags:manage`, high-risk, confirmed with a redacted
  company/flag/value summary, idempotent, audited, timeout 3s, input
  `{ key, enabled, reason }`, output the effective flag, and emits
  `featureFlags.overrideChanged`. Audit target is
  `company-feature-override:<companyId>:<key>`; no input snapshot.
- Future `subscriptions` changes overrides through a tenant-scoped system
  action/event, never by direct DB access.

UI hiding is not authorization. A server action gated by a flag must call the
principal-compatible read through `ctx.call` and reject disabled capability
before side effects.

## 3. Acceptance criteria

- [ ] Default and company override precedence is deterministic.
- [ ] Unknown/hidden flags fail closed and do not leak across surfaces.
- [ ] Cross-tenant override read/write is impossible for all relevant
      principal modes.
- [ ] UI-hidden but directly invoked disabled action still fails server-side.
- [ ] Override write, audit, and event commit atomically and replay safely.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial foundation draft | Make the phase-0 skeleton executable rather than implied | GPT-5.6 Sol |
