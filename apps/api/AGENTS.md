# @showzy/api — Agent Instructions

HTTP transport composition (fnd-T26): the Hono app, better-auth instance,
session resolution, principal dispatch, and the oRPC / OpenAPI mounts.
Auth policy parameters still live in `src/auth/` (fnd-T6).

## Layout

- `src/index.ts` — process entry. Calls `loadServerConfig()` once, boots,
  listens. An invalid environment crashes before anything serves.
- `src/composition.ts` — the action/event composition root (fnd-G1 A2).
  `createActionRegistry` is what `boot.ts` mounts; `buildContractCheckInput`
  is what CI walks (`pnpm --filter @showzy/api contract:check`). Module
  tasks register both barrels, events, subscriptions, call edges, schema-
  ownership rows, and `suiteCoverage` (`@showzy/<module>/suite-coverage`)
  here — never in `packages/core`.
- `src/boot.ts` — opens Postgres + Redis, builds better-auth through
  `buildAuthOptions`, composes the action pipeline, returns `createApp`.
- `src/http/app.ts` — `createApp(composition)`: request-id, trusted-proxy
  IP, better-auth at `/api/auth`, oRPC at `/rpc`, OpenAPI REST at `/api/v1`,
  `GET /health`. Dependencies are injected; tests never read `process.env`.
- `src/http/client-ip.ts` — forwarded-IP headers are trusted only when the
  TCP peer is in `TRUSTED_PROXIES`. Spoofed `X-Forwarded-For` is ignored.
  `createTrustedProxyMatcher` builds the `BlockList` once at app construction.
- `src/pipeline.ts` — fills every protocol hook slot (audit, idempotency,
  rate limit, confirmation) and the Sentry telemetry from
  `src/observability.ts`.
- `src/observability.ts` — process logger + optional Sentry
  (`createProcessObservability`). Keep in lockstep with
  `apps/worker/src/observability.ts`. `flushProcessObservability` drains
  Sentry on shutdown.
- `src/stores/redis.ts` — Redis secondary storage (`GETDEL`), confirmation
  store, Lua token-bucket rate-limit store, and Lua OTP send throttle.
  Tests that do not need Redis use the in-memory stores from
  `@showzy/core` and `stores/memory.ts`.
- `src/auth/` — `buildAuthOptions` (fnd-T6). Every better-auth instance
  still goes through this factory.

## Auth schema generation

`packages/db/src/schema/auth.ts` is generated — never hand-edit it:

```
pnpm --filter @showzy/api auth:generate   # regenerate after changing plugins
pnpm --filter @showzy/api auth:check      # CI: regenerate + fail on diff
```

## Rules

- Every better-auth instance goes through `buildAuthOptions`. Never call
  `betterAuth()` with an inline options object.
- Config comes from `@showzy/config` at the entrypoint; this package never
  reads `process.env` except inside `loadServerConfig`.
- OTP codes never reach logs, error messages, or audit records.
- Process loggers are `createProcessLogger` from `@showzy/config`
  (fnd-T28). Sentry is initialized only when `SENTRY_DSN` is set;
  `beforeSend` scrubs the event. Do not construct a raw `pino()`.
- OTP send/verify responses stay identical for existing and unknown
  identifiers (non-enumeration). Tests pin this over HTTP.
- The 401 gate is this package's job: authenticated principals without a
  session never reach `executeAction` (core's `PermissionDeniedError` is
  defense in depth, 403).
- Selectors (`x-company-id`) are never authority. Consumer/account/public
  dispatch ignores them. Staff membership is verified by core.
- Residual accepted risk: phone OTP codes are plaintext inside the TTL'd
  secondary store for their 5-minute lifetime (the phone plugin has no
  `storeOTP`; they never reach Postgres) — see docs/plans/foundation.md
  "Reported deviations" before touching the phone plugin config.
