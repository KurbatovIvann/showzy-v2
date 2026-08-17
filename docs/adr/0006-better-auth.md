# ADR-0006: better-auth for authentication

- **Status**: Accepted
- **Date**: 2026-08-16

## Context

Supabase Auth is being removed (ADR-0002). Requirements: phone/email OTP
(v1 already had custom OTP delivery via Kyivstar/SMS-Fly), sessions usable
from Expo and the web, self-hosted, TypeScript-native, Drizzle-compatible.
Accounts are mandatory — no anonymous orders (product decision, scope §1.1).

## Decision

better-auth as the authentication library: self-hosted, TS-native, plugs
into Drizzle, supports OTP flows via custom senders.

## Alternatives considered

- **Keep Supabase Auth standalone** — rejected: keeps the vendor dependency
  the rewrite removes.
- **Auth0 / Clerk** — rejected: SaaS lock-in and per-MAU pricing.
- **Hand-rolled auth** — rejected: highest-risk surface to write from
  scratch, even with strong review.

## Consequences

- v1's `auth-hooks` module (custom OTP delivery workaround) collapses into
  better-auth sender config.
- Auth code is a sensitive surface: implemented by the strongest model and
  always security-reviewed (blueprint §7.3).
